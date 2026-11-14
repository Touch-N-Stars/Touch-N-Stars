package com.TouchNStars.dev;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/**
 * Keeps a WebSocket to the PINS daemon's /notifications/stream open while
 * Touch-N-Stars is in the background or swiped away, and turns the rig's
 * notifications into Android notifications.
 *
 * Runs as a foreground service of type connectedDevice: that keeps the process
 * and its network access alive through Doze, which a WebView cannot do. The
 * phone usually sits on the PINS hotspot without internet, so FCM is not an
 * option; everything here is local network only. The process-wide network
 * binding from WifiNetworkBinderPlugin applies to this socket as well.
 *
 * While the app is in the foreground, events are only recorded (lastSeq) and
 * not posted, because the app shows them as toasts itself.
 */
public class SessionMonitorService extends Service {
    private static final String TAG = "SessionMonitor";

    static final String PREFS = "tns_session_monitor";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_STREAM_URL = "streamUrl";
    static final String KEY_TOKEN = "token";
    static final String KEY_MIN_SEVERITY = "minSeverity";
    static final String KEY_RIG_NAME = "rigName";
    static final String KEY_BOOT_ID = "bootId";
    static final String KEY_LAST_SEQ = "lastSeq";
    static final String KEY_LAST_EVENT_AT = "lastEventAt";
    static final String KEY_LABELS = "labels";

    static final String ACTION_STOP = "com.TouchNStars.dev.sessionmonitor.STOP";

    private static final String CHANNEL_SERVICE = "tns_session_monitor";
    private static final String CHANNEL_ALERTS = "tns_session_alerts";
    private static final String CHANNEL_EVENTS = "tns_session_events";
    private static final int ONGOING_NOTIFICATION_ID = 7301;
    private static final int EVENT_NOTIFICATION_BASE_ID = 7400;
    private static final int EVENT_NOTIFICATION_SLOTS = 50;
    private static final int EVENT_SUMMARY_BASE_ID = 7390; // + severity rank (0-3)

    private static final long RECONNECT_MIN_MS = 2_000;
    private static final long RECONNECT_MAX_MS = 60_000;
    // The daemon sends {"kind":"ping"} every 25 s; silence beyond this means a dead socket.
    private static final long SILENCE_TIMEOUT_MS = 75_000;
    // Covers the reconnect backoff (max 60 s) with margin.
    private static final long WAKE_LOCK_TIMEOUT_MS = 10 * 60_000;

    static volatile boolean running = false;
    static volatile boolean connected = false;
    static volatile boolean appInForeground = true;

    private HandlerThread workerThread;
    private Handler worker;
    private OkHttpClient client;
    private WebSocket socket;
    private int socketGeneration = 0;
    private long reconnectDelayMs = RECONNECT_MIN_MS;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private boolean stopping = false;

    private final Runnable silenceWatchdog = () -> {
        Log.w(TAG, "No message from the rig for " + SILENCE_TIMEOUT_MS + " ms, reconnecting");
        if (socket != null) socket.cancel();
    };

    private final Runnable connectRunnable = this::connect;

    // ------------------------------------------------------------------ lifecycle

    @Override
    public void onCreate() {
        super.onCreate();
        workerThread = new HandlerThread("SessionMonitor");
        workerThread.start();
        worker = new Handler(workerThread.getLooper());
        client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
            .build();
        createChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            prefs(this).edit().putBoolean(KEY_ENABLED, false).apply();
            stopping = true;
            stopForegroundCompat();
            stopSelf();
            return START_NOT_STICKY;
        }

        SharedPreferences prefs = prefs(this);
        if (!prefs.getBoolean(KEY_ENABLED, false) || prefs.getString(KEY_STREAM_URL, null) == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            startForegroundCompat(buildOngoingNotification());
        } catch (RuntimeException e) {
            // ForegroundServiceStartNotAllowedException (Android 12+) when the system
            // restarts us while the app is in the background and not exempt.
            Log.e(TAG, "Could not enter foreground", e);
            stopSelf();
            return START_NOT_STICKY;
        }

        acquireLocks();
        running = true;
        worker.post(() -> {
            reconnectDelayMs = RECONNECT_MIN_MS;
            worker.removeCallbacks(connectRunnable);
            connect();
        });
        // Restart after the system killed the process; the config is in prefs.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopping = true;
        running = false;
        connected = false;
        if (worker != null) {
            worker.removeCallbacksAndMessages(null);
            worker.post(() -> {
                if (socket != null) socket.close(1000, "monitor stopped");
                socket = null;
            });
        }
        if (workerThread != null) workerThread.quitSafely();
        releaseLocks();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ------------------------------------------------------------------ socket

    private void connect() {
        if (stopping) return;
        SharedPreferences prefs = prefs(this);
        String streamUrl = prefs.getString(KEY_STREAM_URL, null);
        if (streamUrl == null) return;

        Uri.Builder uri = Uri.parse(streamUrl).buildUpon()
            .appendQueryParameter("token", prefs.getString(KEY_TOKEN, ""))
            .appendQueryParameter("since", String.valueOf(prefs.getLong(KEY_LAST_SEQ, 0)));
        String bootId = prefs.getString(KEY_BOOT_ID, null);
        if (bootId != null) uri.appendQueryParameter("bootId", bootId);

        if (socket != null) socket.cancel();
        final int generation = ++socketGeneration;
        Request request = new Request.Builder().url(uri.build().toString()).build();
        socket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                worker.post(() -> {
                    if (generation != socketGeneration) return;
                    connected = true;
                    reconnectDelayMs = RECONNECT_MIN_MS;
                    armWatchdog();
                    updateOngoingNotification();
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                worker.post(() -> {
                    if (generation != socketGeneration) return;
                    armWatchdog();
                    handleMessage(text);
                });
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                worker.post(() -> onSocketGone(generation, "closed " + code + " " + reason));
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                worker.post(() -> onSocketGone(generation, String.valueOf(t)));
            }
        });
    }

    private void onSocketGone(int generation, String reason) {
        if (generation != socketGeneration) return;
        Log.i(TAG, "Stream disconnected: " + reason);
        connected = false;
        worker.removeCallbacks(silenceWatchdog);
        socket = null;
        if (stopping) return;
        updateOngoingNotification();
        worker.removeCallbacks(connectRunnable);
        worker.postDelayed(connectRunnable, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_MS);
    }

    private void armWatchdog() {
        worker.removeCallbacks(silenceWatchdog);
        worker.postDelayed(silenceWatchdog, SILENCE_TIMEOUT_MS);
        refreshWakeLock();
    }

    /**
     * The wake lock is time-limited and extended on every message (the daemon pings
     * every 25 s), so a stuck service cannot keep the CPU awake for the whole night.
     */
    private void refreshWakeLock() {
        if (wakeLock != null && !stopping) wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
    }

    private void handleMessage(String text) {
        JSONObject message;
        try {
            message = new JSONObject(text);
        } catch (JSONException e) {
            return;
        }
        String kind = message.optString("kind");
        SharedPreferences prefs = prefs(this);
        if ("hello".equals(kind)) {
            String bootId = message.optString("bootId", null);
            if (bootId != null && !bootId.equals(prefs.getString(KEY_BOOT_ID, null))) {
                // Daemon restarted: its sequence numbers start over and it replays
                // its (new) buffer from the beginning.
                prefs.edit().putString(KEY_BOOT_ID, bootId).putLong(KEY_LAST_SEQ, 0).apply();
            }
            return;
        }
        if (!"event".equals(kind)) return;

        JSONObject event = message.optJSONObject("event");
        if (event == null) return;
        long seq = event.optLong("seq", 0);
        if (seq <= prefs.getLong(KEY_LAST_SEQ, 0)) return;
        prefs.edit()
            .putLong(KEY_LAST_SEQ, seq)
            .putLong(KEY_LAST_EVENT_AT, System.currentTimeMillis())
            .apply();

        String severity = event.optString("severity", "info");
        if (appInForeground) return;
        if (severityRank(severity) < severityRank(prefs.getString(KEY_MIN_SEVERITY, "warning"))) return;
        postEventNotification(seq, severity, event.optString("title", ""), event.optString("message", ""));
    }

    static int severityRank(String severity) {
        if ("error".equals(severity)) return 3;
        if ("warning".equals(severity)) return 2;
        if ("success".equals(severity)) return 1;
        return 0;
    }

    // ------------------------------------------------------------------ notifications

    private JSONObject labels() {
        try {
            return new JSONObject(prefs(this).getString(KEY_LABELS, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private String label(String key, String fallback) {
        String value = labels().optString(key, "");
        return value.isEmpty() ? fallback : value;
    }

    private void createChannels() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel service = new NotificationChannel(
            CHANNEL_SERVICE, label("channelService", "Session monitor"), NotificationManager.IMPORTANCE_LOW);
        service.setShowBadge(false);
        manager.createNotificationChannel(service);

        NotificationChannel alerts = new NotificationChannel(
            CHANNEL_ALERTS, label("channelAlerts", "Rig alerts"), NotificationManager.IMPORTANCE_HIGH);
        alerts.enableVibration(true);
        manager.createNotificationChannel(alerts);

        NotificationChannel events = new NotificationChannel(
            CHANNEL_EVENTS, label("channelEvents", "Rig events"), NotificationManager.IMPORTANCE_DEFAULT);
        manager.createNotificationChannel(events);
    }

    private PendingIntent openAppIntent() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildOngoingNotification() {
        // Labels may have changed since the channels were created (language switch).
        createChannels();
        String rig = prefs(this).getString(KEY_RIG_NAME, "PINS");
        String text = connected
            ? label("ongoingConnected", "Connected to {rig}").replace("{rig}", rig)
            : label("ongoingReconnecting", "Connecting to {rig}…").replace("{rig}", rig);

        Intent stop = new Intent(this, SessionMonitorService.class).setAction(ACTION_STOP);
        PendingIntent stopIntent = PendingIntent.getService(
            this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_tns)
            .setLargeIcon(BitmapFactory.decodeResource(getResources(), R.drawable.tns_notification_logo))
            .setContentTitle(label("ongoingTitle", "Watching your session"))
            .setContentText(text)
            .setContentIntent(openAppIntent())
            .addAction(0, label("stop", "Stop"), stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    @SuppressLint("MissingPermission") // guarded by canPostNotifications()
    private void updateOngoingNotification() {
        if (!canPostNotifications() || stopping) return;
        try {
            NotificationManagerCompat.from(this).notify(ONGOING_NOTIFICATION_ID, buildOngoingNotification());
        } catch (SecurityException e) {
            Log.w(TAG, "Notification permission revoked", e);
        }
    }

    @SuppressLint("MissingPermission") // guarded by canPostNotifications()
    private void postEventNotification(long seq, String severity, String title, String message) {
        if (!canPostNotifications()) return;
        boolean alert = severityRank(severity) >= 2;
        String heading = title.isEmpty() ? label("defaultTitle", "PINS") : title;
        int icon = severityIcon(severity);
        int color = severityColor(severity);
        Notification notification = new NotificationCompat.Builder(this, alert ? CHANNEL_ALERTS : CHANNEL_EVENTS)
            // The status bar always draws the small icon white; the colour shows in the
            // shade, and the large icon carries it everywhere else.
            .setSmallIcon(icon)
            .setColor(color)
            .setLargeIcon(tintedBitmap(icon, color))
            .setContentTitle(heading)
            .setContentText(message)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(openAppIntent())
            .setAutoCancel(true)
            .setPriority(alert ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(alert ? NotificationCompat.CATEGORY_ERROR : NotificationCompat.CATEGORY_STATUS)
            .setWhen(System.currentTimeMillis())
            .setGroup(groupKey(severity))
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
            .build();
        // One group per severity, each with its own summary. Without this Android bundles
        // four or more notifications under one header with an arbitrary child's icon
        // (a green check over a bundle that holds an error).
        Notification summary = new NotificationCompat.Builder(this, alert ? CHANNEL_ALERTS : CHANNEL_EVENTS)
            .setSmallIcon(icon)
            .setColor(color)
            .setContentTitle(label("defaultTitle", "PINS"))
            .setContentText(heading)
            .setContentIntent(openAppIntent())
            .setAutoCancel(true)
            .setGroup(groupKey(severity))
            .setGroupSummary(true)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
            .build();
        // A rotating set of ids: a long night keeps at most this many in the shade.
        int id = EVENT_NOTIFICATION_BASE_ID + (int) (seq % EVENT_NOTIFICATION_SLOTS);
        try {
            NotificationManagerCompat manager = NotificationManagerCompat.from(this);
            manager.notify(id, notification);
            manager.notify(EVENT_SUMMARY_BASE_ID + severityRank(severity), summary);
        } catch (SecurityException e) {
            Log.w(TAG, "Notification permission revoked", e);
        }
    }

    private static String groupKey(String severity) {
        return "tns-rig-" + (severityRank(severity) > 0 ? severity : "info");
    }

    static int severityIcon(String severity) {
        if ("error".equals(severity)) return R.drawable.ic_stat_error;
        if ("warning".equals(severity)) return R.drawable.ic_stat_warning;
        if ("success".equals(severity)) return R.drawable.ic_stat_success;
        return R.drawable.ic_stat_info;
    }

    static int severityColor(String severity) {
        if ("error".equals(severity)) return 0xFFE53935; // red
        if ("warning".equals(severity)) return 0xFFFFA000; // amber
        if ("success".equals(severity)) return 0xFF43A047; // green
        return 0xFF1E88E5; // blue
    }

    private Bitmap tintedBitmap(int drawableRes, int color) {
        Drawable drawable = ContextCompat.getDrawable(this, drawableRes);
        if (drawable == null) return null;
        drawable = drawable.mutate();
        drawable.setTint(color);
        int size = Math.round(48 * getResources().getDisplayMetrics().density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(new Canvas(bitmap));
        return bitmap;
    }

    private boolean canPostNotifications() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    // ------------------------------------------------------------------ helpers

    private void startForegroundCompat(Notification notification) {
        startForeground(ONGOING_NOTIFICATION_ID, notification,
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
    }

    private void stopForegroundCompat() {
        stopForeground(STOP_FOREGROUND_REMOVE);
    }

    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (power != null) {
                wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TouchNStars:SessionMonitor");
                wakeLock.setReferenceCounted(false);
            }
        }
        refreshWakeLock();

        if (wifiLock == null) {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                // Keeps the radio from dropping into power save and losing the rig's hotspot.
                @SuppressWarnings("deprecation")
                int mode = WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiLock = wifi.createWifiLock(mode, "TouchNStars:SessionMonitor");
                wifiLock.setReferenceCounted(false);
            }
        }
        if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

package com.TouchNStars.dev;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * JS bridge for {@link SessionMonitorService}: phone notifications from the rig
 * while the app is in the background or closed (Touch-N-Stars issue #1492).
 */
@CapacitorPlugin(
    name = "SessionMonitor",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class SessionMonitorPlugin extends Plugin {

    @Override
    public void load() {
        // The plugin loads with the activity, i.e. in the foreground.
        SessionMonitorService.appInForeground = true;
    }

    @Override
    protected void handleOnResume() {
        SessionMonitorService.appInForeground = true;
    }

    @Override
    protected void handleOnPause() {
        SessionMonitorService.appInForeground = false;
    }

    @Override
    protected void handleOnDestroy() {
        // Swiped away / activity finished: the service keeps running on its own.
        SessionMonitorService.appInForeground = false;
    }

    /**
     * start({ streamUrl, token, minSeverity, rigName, bootId?, since?, labels? })
     *
     * bootId/since prime the cursor so the first connection does not replay events
     * the user already saw in the app. They are ignored when the service already
     * holds a cursor for the same stream.
     */
    @PluginMethod
    public void start(PluginCall call) {
        String streamUrl = call.getString("streamUrl");
        if (streamUrl == null || !(streamUrl.startsWith("ws://") || streamUrl.startsWith("wss://"))) {
            call.reject("streamUrl must be a ws:// or wss:// URL");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Notification permission denied", "PERMISSION_DENIED");
            return;
        }
        startService(call);
    }

    private void startService(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = SessionMonitorService.prefs(context);
        String streamUrl = call.getString("streamUrl");
        SharedPreferences.Editor editor = prefs.edit()
            .putBoolean(SessionMonitorService.KEY_ENABLED, true)
            .putString(SessionMonitorService.KEY_TOKEN, call.getString("token", ""))
            .putString(SessionMonitorService.KEY_MIN_SEVERITY, call.getString("minSeverity", "warning"))
            .putString(SessionMonitorService.KEY_RIG_NAME, call.getString("rigName", "PINS"));

        JSObject labels = call.getObject("labels");
        if (labels != null) editor.putString(SessionMonitorService.KEY_LABELS, labels.toString());

        // A different rig (or first start): take the cursor the app hands over.
        if (!streamUrl.equals(prefs.getString(SessionMonitorService.KEY_STREAM_URL, null))
            || prefs.getString(SessionMonitorService.KEY_BOOT_ID, null) == null) {
            editor.putString(SessionMonitorService.KEY_STREAM_URL, streamUrl);
            String bootId = call.getString("bootId");
            if (bootId != null) {
                editor.putString(SessionMonitorService.KEY_BOOT_ID, bootId);
            } else {
                editor.remove(SessionMonitorService.KEY_BOOT_ID);
            }
            Long since = call.getLong("since");
            editor.putLong(SessionMonitorService.KEY_LAST_SEQ, since != null ? Math.max(0, since) : 0);
        }
        editor.apply();

        try {
            ContextCompat.startForegroundService(context, new Intent(context, SessionMonitorService.class));
        } catch (RuntimeException e) {
            call.reject("Could not start the session monitor: " + e.getMessage(), "START_FAILED", e);
            return;
        }
        call.resolve(status());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        SessionMonitorService.prefs(context).edit()
            .putBoolean(SessionMonitorService.KEY_ENABLED, false)
            .apply();
        context.stopService(new Intent(context, SessionMonitorService.class));
        SessionMonitorService.running = false;
        SessionMonitorService.connected = false;
        call.resolve(status());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    /** Opens the system list where the user can exempt the app from battery optimisation. */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (RuntimeException e) {
            Intent details = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getContext().getPackageName(), null));
            details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(details);
        }
        call.resolve();
    }

    private JSObject status() {
        Context context = getContext();
        SharedPreferences prefs = SessionMonitorService.prefs(context);
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("enabled", prefs.getBoolean(SessionMonitorService.KEY_ENABLED, false));
        result.put("running", SessionMonitorService.running);
        result.put("connected", SessionMonitorService.connected);
        result.put("streamUrl", prefs.getString(SessionMonitorService.KEY_STREAM_URL, null));
        result.put("bootId", prefs.getString(SessionMonitorService.KEY_BOOT_ID, null));
        result.put("lastSeq", prefs.getLong(SessionMonitorService.KEY_LAST_SEQ, 0));
        long lastEventAt = prefs.getLong(SessionMonitorService.KEY_LAST_EVENT_AT, 0);
        result.put("lastEventAt", lastEventAt > 0 ? lastEventAt : null);
        result.put("notificationsGranted",
            Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put("ignoringBatteryOptimizations",
            power != null && power.isIgnoringBatteryOptimizations(context.getPackageName()));
        return result;
    }
}

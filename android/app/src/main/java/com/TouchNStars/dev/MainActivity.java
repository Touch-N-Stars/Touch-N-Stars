package com.TouchNStars.dev;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local Capacitor plugins before BridgeActivity initializes the bridge.
        registerPlugin(MediaScannerPlugin.class);
        registerPlugin(WifiSignalPlugin.class);
        registerPlugin(SkyOrientationPlugin.class);

        // Register WifiNetworkBinder plugin to keep the backend reachable on
        // internet-less Wi-Fi (PINS hotspot) while mobile data is active
        registerPlugin(WifiNetworkBinderPlugin.class);

        // Phone notifications from the rig while the app is in the background (#1492)
        registerPlugin(SessionMonitorPlugin.class);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onDestroy() {
        super.onDestroy(); 
    }

    @Override
    public void onBackPressed() {
        // Show confirmation dialog before exiting
        new android.app.AlertDialog.Builder(this)
            .setTitle("Exit Application")
            .setMessage("Are you sure you want to close Touch'N'Stars?")
            .setPositiveButton("Yes", (dialog, which) -> {
                // Exit the app
                if (android.os.Build.VERSION.SDK_INT >= 33) {
                    finishAfterTransition();
                } else {
                    super.onBackPressed();
                }
            })
            .setNegativeButton("No", null)
            .show();
    }
}

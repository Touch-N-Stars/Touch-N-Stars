# iOS: rig notifications in the background (Local Push Connectivity)

Part of #1492. Android uses a foreground service (`SessionMonitorService.java`). iOS does
not let an app keep a socket open in the background, so it uses **Local Push
Connectivity**: the app saves an `NEAppPushManager` configuration with the rig's Wi-Fi
networks, and iOS runs the `PushProvider` network extension whenever the phone is on one
of them, also while Touch-N-Stars is suspended or closed. The extension keeps the
pinsdaemon stream `ws://<pins>:8000/notifications/stream` open and posts local
notifications. The protocol and cursor rules are the same as on Android.

## Files

| File | Target | Role |
| --- | --- | --- |
| `ios/App/App/SessionMonitorPlugin.swift` | App | Capacitor plugin `SessionMonitor` (same JS API as Android). Registered in `MainViewController.swift`. |
| `ios/App/App/SessionMonitorShared.swift` | **App and PushProvider** | Constants, App Group storage (cursor, foreground flag) |
| `ios/App/PushProvider/PushProvider.swift` | PushProvider | `NEAppPushProvider` subclass: WebSocket, reconnect, watchdog, notifications |
| `ios/App/PushProvider/Info.plist` | PushProvider | Extension point `com.apple.networkextension.app-push`, ATS for local `ws://` |
| `ios/App/PushProvider/PushProvider.entitlements` | PushProvider | `app-push-provider`, App Group |

The two app files are already in the App target of `App.xcodeproj`. The extension target
has to be created in Xcode (below), because a hand-edited target would be hard to review.

## One-time setup

### 1. Apple Developer portal

1. Request the **Local Push Connectivity** entitlement
   (`com.apple.developer.networking.networkextension` = `app-push-provider`) for the team.
2. App ID `com.TouchNStars.dev`: enable **Network Extensions** and **App Groups**, and
   assign the group `group.com.TouchNStars.dev`.
3. New App ID `com.TouchNStars.dev.PushProvider`: the same two capabilities and group.
4. Regenerate the provisioning profiles for both IDs.

The bundle ID, App Group and extension ID are constants in
`SessionMonitorShared.swift`. If you pick other names, change them there.

### 2. Xcode

1. **File → New → Target… → Network Extension.** Product name `PushProvider`, bundle ID
   `com.TouchNStars.dev.PushProvider`, language Swift, embed in `App`.
2. Delete the source and Info.plist files Xcode generated for the target. Add the existing
   files from `ios/App/PushProvider/` to the target: **Add Files to "App"…**, untick
   "Copy items", target `PushProvider` only.
3. In the PushProvider target's build settings:
   - `INFOPLIST_FILE` = `PushProvider/Info.plist`, `GENERATE_INFOPLIST_FILE` = `NO`
   - `CODE_SIGN_ENTITLEMENTS` = `PushProvider/PushProvider.entitlements`
   - `IPHONEOS_DEPLOYMENT_TARGET` = 15.0 or higher (`start()` without a completion handler
     is iOS 15+)
4. Select `App/SessionMonitorShared.swift` and also tick **PushProvider** under Target
   Membership.
5. **App target → Signing & Capabilities:**
   - **+ Network Extensions**, tick **App Push Provider**
   - **+ App Groups**, add `group.com.TouchNStars.dev`

   This writes both entitlements into `App/App.entitlements`.
6. **PushProvider target → Signing & Capabilities:** check that the same two capabilities
   are shown. They come from `PushProvider.entitlements`.

## How it behaves

- **Wi-Fi networks (`matchSSIDs`).** Each time the app reaches a PINS rig, it remembers the
  phone's current Wi-Fi and the networks the daemon reports in `/wifi/status` (its hotspot
  and the client Wi-Fi), per rig, at most 10. The card under PINS → System lists them and
  can forget them. The extension only runs on those networks. Elsewhere only ntfy reaches
  the user, and only while the Pi has internet.
- **Foreground.** The app writes a foreground flag into the App Group. While it is set, the
  extension only advances the cursor and does not post notifications, because the in-app
  toasts already show the events.
- **Cursor.** `bootId`/`lastSeq` live in the App Group. A new configuration (new rig, first
  start) hands over the app's cursor through `providerConfiguration` (`configId`,
  `initialBootId`, `initialSince`), so the first connection does not replay the buffer.
- **No App Group.** If the App Group entitlement is missing, everything still works except
  the foreground flag and the status the app shows ("Watching the rig").

## Testing (real device only, the extension does not run in the Simulator)

1. Join the rig's Wi-Fi (PINS hotspot or home Wi-Fi), open the app, connect to the rig.
2. PINS → System → Rig notifications: enable **Notify me in the background** and allow
   notifications.
3. Tap **Send test notification**, then lock the phone within 10 s. A banner should appear.
4. Close the app from the app switcher and trigger a warning on the rig, for example by
   unplugging a USB device. It should still arrive.
5. Logs: Console.app on the Mac, device selected, filter by subsystem
   `com.TouchNStars.dev.PushProvider`.

If `saveToPreferences` fails with a configuration or permission error, the entitlement or
provisioning profile is missing. The card shows the iOS error text.

import Capacitor
import NetworkExtension
import UIKit
import UserNotifications

/// iOS side of the SessionMonitor plugin (same JS API as the Android plugin).
///
/// iOS does not let an app keep a socket open in the background. Local Push Connectivity
/// does: the app saves an NEAppPushManager configuration with the Wi-Fi networks of the
/// rig, and iOS runs the PushProvider extension (ios/App/PushProvider) whenever the phone
/// is on one of them, even while the app is suspended or closed. The extension keeps the
/// pinsdaemon notification stream open and posts local notifications.
///
/// Needs the `com.apple.developer.networking.networkextension` entitlement with
/// `app-push-provider` on the app and the extension (granted by Apple on request), see
/// docs/features/ios-session-notifications.md.
@objc(SessionMonitorPlugin)
public class SessionMonitorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SessionMonitorPlugin"
    public let jsName = "SessionMonitor"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openBatterySettings", returnType: CAPPluginReturnPromise)
    ]

    private var observers: [NSObjectProtocol] = []

    override public func load() {
        SessionMonitorShared.appInForeground = true
        let center = NotificationCenter.default
        observers.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in
            SessionMonitorShared.appInForeground = true
        })
        observers.append(center.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { _ in
            SessionMonitorShared.appInForeground = false
        })
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    // MARK: - start

    /// start({ streamUrl, token, minSeverity, rigName, bootId?, since?, labels?, ssids })
    @objc func start(_ call: CAPPluginCall) {
        guard let streamUrl = call.getString("streamUrl"),
              streamUrl.hasPrefix("ws://") || streamUrl.hasPrefix("wss://") else {
            call.reject("streamUrl must be a ws:// or wss:// URL")
            return
        }
        let ssids = (call.getArray("ssids", String.self) ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !ssids.isEmpty else {
            call.reject("No Wi-Fi network known for this rig", "NO_SSID")
            return
        }

        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) {
            granted, _ in
            guard granted else {
                call.reject("Notification permission denied", "PERMISSION_DENIED")
                return
            }
            self.saveConfiguration(call, streamUrl: streamUrl, ssids: ssids)
        }
    }

    private func saveConfiguration(_ call: CAPPluginCall, streamUrl: String, ssids: [String]) {
        NEAppPushManager.loadAllFromPreferences { managers, error in
            if let error = error {
                call.reject("Could not load the background connection: \(error.localizedDescription)",
                            "START_FAILED", error)
                return
            }
            let manager = managers?.first ?? NEAppPushManager()
            let previous = manager.providerConfiguration ?? [:]
            let sameStream = previous[SessionMonitorShared.configStreamUrl] as? String == streamUrl

            var configuration: [String: Any] = [
                SessionMonitorShared.configStreamUrl: streamUrl,
                SessionMonitorShared.configToken: call.getString("token") ?? "",
                SessionMonitorShared.configMinSeverity: call.getString("minSeverity") ?? "warning",
                SessionMonitorShared.configRigName: call.getString("rigName") ?? "PINS"
            ]
            if let labels = call.getObject("labels") {
                configuration[SessionMonitorShared.configLabels] =
                    labels.compactMapValues { $0 as? String }
            }
            if sameStream, let configId = previous[SessionMonitorShared.configId] {
                // Same rig: keep the extension's cursor.
                configuration[SessionMonitorShared.configId] = configId
            } else {
                // New rig or first start: the extension adopts the cursor the app hands over,
                // so it does not replay events the user already saw in the app.
                configuration[SessionMonitorShared.configId] = UUID().uuidString
                if let bootId = call.getString("bootId") {
                    configuration[SessionMonitorShared.configInitialBootId] = bootId
                }
                configuration[SessionMonitorShared.configInitialSince] = max(0, call.getInt("since") ?? 0)
            }

            manager.localizedDescription = "Touch-N-Stars"
            manager.providerBundleIdentifier = SessionMonitorShared.providerBundleIdentifier
            manager.matchSSIDs = ssids
            manager.providerConfiguration = configuration
            manager.isEnabled = true
            manager.saveToPreferences { error in
                if let error = error {
                    call.reject("iOS refused the background connection: \(error.localizedDescription)",
                                "START_FAILED", error)
                    return
                }
                self.status(manager) { call.resolve($0) }
            }
        }
    }

    // MARK: - stop / status

    @objc func stop(_ call: CAPPluginCall) {
        NEAppPushManager.loadAllFromPreferences { managers, _ in
            let all = managers ?? []
            let group = DispatchGroup()
            for manager in all {
                group.enter()
                manager.removeFromPreferences { _ in group.leave() }
            }
            group.notify(queue: .main) {
                SessionMonitorShared.connected = false
                self.status(nil) { call.resolve($0) }
            }
        }
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        NEAppPushManager.loadAllFromPreferences { managers, _ in
            self.status(managers?.first) { call.resolve($0) }
        }
    }

    /// No battery optimisation list on iOS; opens the app's settings page instead
    /// (notifications live there).
    @objc func openBatterySettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    private func status(_ manager: NEAppPushManager?, completion: @escaping ([String: Any]) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let enabled = manager?.isEnabled ?? false
            let active = manager?.isActive ?? false
            var result: [String: Any] = [
                "available": true,
                "platform": "ios",
                "enabled": enabled,
                "running": active,
                "connected": active && SessionMonitorShared.connected,
                "lastSeq": SessionMonitorShared.lastSeq,
                "ssids": manager?.matchSSIDs ?? [],
                "notificationsGranted": settings.authorizationStatus == .authorized,
                // iOS manages the extension's power use; there is nothing to exempt.
                "ignoringBatteryOptimizations": true
            ]
            result["streamUrl"] =
                manager?.providerConfiguration?[SessionMonitorShared.configStreamUrl] as? String
            result["bootId"] = SessionMonitorShared.bootId
            let lastEventAt = SessionMonitorShared.lastEventAt
            result["lastEventAt"] = lastEventAt > 0 ? lastEventAt : nil
            completion(result)
        }
    }
}

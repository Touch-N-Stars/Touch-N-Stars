import Foundation

/// Shared between the app (SessionMonitorPlugin) and the PushProvider network extension.
/// The file must be a member of BOTH targets (App and PushProvider).
///
/// State lives in the App Group's UserDefaults so the extension and the app see the same
/// cursor and foreground flag. Without the App Group entitlement `UserDefaults(suiteName:)`
/// still works but is not shared: the extension then falls back to the initial cursor it
/// gets through its providerConfiguration, and posts notifications while the app is open.
enum SessionMonitorShared {
    static let appGroup = "group.com.TouchNStars.dev"
    static let providerBundleIdentifier = "com.TouchNStars.dev.PushProvider"

    // providerConfiguration keys (set by the app, read by the extension)
    static let configStreamUrl = "streamUrl"
    static let configToken = "token"
    static let configMinSeverity = "minSeverity"
    static let configRigName = "rigName"
    static let configLabels = "labels"
    static let configId = "configId"
    static let configInitialBootId = "initialBootId"
    static let configInitialSince = "initialSince"

    // App Group defaults keys
    private static let keyBootId = "sessionMonitor.bootId"
    private static let keyLastSeq = "sessionMonitor.lastSeq"
    private static let keyLastEventAt = "sessionMonitor.lastEventAt"
    private static let keyAppliedConfigId = "sessionMonitor.appliedConfigId"
    private static let keyConnected = "sessionMonitor.connected"
    private static let keyAppInForeground = "sessionMonitor.appInForeground"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroup) ?? .standard
    }

    static var bootId: String? {
        get { defaults.string(forKey: keyBootId) }
        set { defaults.set(newValue, forKey: keyBootId) }
    }

    static var lastSeq: Int {
        get { defaults.integer(forKey: keyLastSeq) }
        set { defaults.set(newValue, forKey: keyLastSeq) }
    }

    /// Milliseconds since 1970, like Android's status, or 0.
    static var lastEventAt: Double {
        get { defaults.double(forKey: keyLastEventAt) }
        set { defaults.set(newValue, forKey: keyLastEventAt) }
    }

    static var appliedConfigId: String? {
        get { defaults.string(forKey: keyAppliedConfigId) }
        set { defaults.set(newValue, forKey: keyAppliedConfigId) }
    }

    static var connected: Bool {
        get { defaults.bool(forKey: keyConnected) }
        set { defaults.set(newValue, forKey: keyConnected) }
    }

    static var appInForeground: Bool {
        get { defaults.bool(forKey: keyAppInForeground) }
        set { defaults.set(newValue, forKey: keyAppInForeground) }
    }

    static func severityRank(_ severity: String) -> Int {
        switch severity {
        case "error": return 3
        case "warning": return 2
        case "success": return 1
        default: return 0
        }
    }
}

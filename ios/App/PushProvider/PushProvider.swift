import Foundation
import NetworkExtension
import UserNotifications
import os.log

/// Local Push Connectivity provider: iOS runs it while the phone is on one of the Wi-Fi
/// networks the app configured (NEAppPushManager.matchSSIDs), also when Touch-N-Stars is
/// suspended or closed. It keeps the pinsdaemon notification stream
/// (ws://<pins>:8000/notifications/stream) open and turns rig events into local
/// notifications. Same protocol and cursor rules as the Android SessionMonitorService.
///
/// Target membership: this file, SessionMonitorShared.swift (from ios/App/App) and
/// Info.plist / PushProvider.entitlements in this folder.
final class PushProvider: NEAppPushProvider {
    private static let reconnectMin: TimeInterval = 2
    private static let reconnectMax: TimeInterval = 60
    // The daemon sends {"kind":"ping"} every 25 s; silence beyond this means a dead socket.
    private static let silenceTimeout: TimeInterval = 75

    private let log = OSLog(subsystem: "com.TouchNStars.dev.PushProvider", category: "stream")
    private let queue = DispatchQueue(label: "com.TouchNStars.dev.PushProvider")
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 15
        let delegateQueue = OperationQueue()
        delegateQueue.underlyingQueue = queue
        return URLSession(configuration: configuration, delegate: nil, delegateQueue: delegateQueue)
    }()

    private var task: URLSessionWebSocketTask?
    private var generation = 0
    private var reconnectDelay = PushProvider.reconnectMin
    private var reconnectWork: DispatchWorkItem?
    private var watchdogWork: DispatchWorkItem?
    private var running = false

    // MARK: - lifecycle

    override func start() {
        queue.async {
            self.running = true
            self.adoptInitialCursorIfNeeded()
            self.reconnectDelay = PushProvider.reconnectMin
            self.connect()
        }
    }

    override func stop(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        queue.async {
            os_log("Stopping (reason %{public}ld)", log: self.log, type: .info, reason.rawValue)
            self.running = false
            self.reconnectWork?.cancel()
            self.watchdogWork?.cancel()
            self.generation += 1
            self.task?.cancel(with: .goingAway, reason: nil)
            self.task = nil
            SessionMonitorShared.connected = false
            completionHandler()
        }
    }

    /// Called periodically by the system while the provider runs.
    override func handleTimerEvent() {
        queue.async {
            if self.running && self.task == nil && self.reconnectWork == nil {
                self.connect()
            }
        }
    }

    // MARK: - configuration

    private var configuration: [String: Any] { providerConfiguration ?? [:] }

    private func string(_ key: String, _ fallback: String = "") -> String {
        (configuration[key] as? String) ?? fallback
    }

    private func label(_ key: String, _ fallback: String) -> String {
        let labels = configuration[SessionMonitorShared.configLabels] as? [String: String] ?? [:]
        let value = labels[key] ?? ""
        return value.isEmpty ? fallback : value
    }

    /// A new configuration (new rig, first start) brings the cursor the app had at that
    /// moment, so the first connection does not replay events already seen in the app.
    private func adoptInitialCursorIfNeeded() {
        let configId = string(SessionMonitorShared.configId)
        guard !configId.isEmpty, configId != SessionMonitorShared.appliedConfigId else { return }
        SessionMonitorShared.bootId = configuration[SessionMonitorShared.configInitialBootId] as? String
        SessionMonitorShared.lastSeq = (configuration[SessionMonitorShared.configInitialSince] as? Int) ?? 0
        SessionMonitorShared.appliedConfigId = configId
    }

    // MARK: - socket

    private func connect() {
        guard running else { return }
        reconnectWork = nil
        guard var components = URLComponents(string: string(SessionMonitorShared.configStreamUrl)) else {
            os_log("Invalid stream URL", log: log, type: .error)
            return
        }
        var query = [
            URLQueryItem(name: "token", value: string(SessionMonitorShared.configToken)),
            URLQueryItem(name: "since", value: String(SessionMonitorShared.lastSeq))
        ]
        if let bootId = SessionMonitorShared.bootId {
            query.append(URLQueryItem(name: "bootId", value: bootId))
        }
        components.queryItems = query
        guard let url = components.url else { return }

        task?.cancel(with: .goingAway, reason: nil)
        generation += 1
        let current = generation
        let socket = session.webSocketTask(with: url)
        task = socket
        socket.resume()
        armWatchdog(current)
        receive(current)
    }

    private func receive(_ current: Int) {
        task?.receive { [weak self] result in
            guard let self = self else { return }
            self.queue.async {
                guard current == self.generation else { return }
                switch result {
                case .failure(let error):
                    self.socketGone(current, error.localizedDescription)
                case .success(let message):
                    if !SessionMonitorShared.connected {
                        SessionMonitorShared.connected = true
                        self.reconnectDelay = PushProvider.reconnectMin
                    }
                    self.armWatchdog(current)
                    switch message {
                    case .string(let text):
                        self.handle(text)
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) { self.handle(text) }
                    @unknown default:
                        break
                    }
                    self.receive(current)
                }
            }
        }
    }

    private func armWatchdog(_ current: Int) {
        watchdogWork?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, current == self.generation else { return }
            os_log("No message for %{public}.0f s, reconnecting", log: self.log, type: .info,
                   PushProvider.silenceTimeout)
            self.socketGone(current, "silence")
        }
        watchdogWork = work
        queue.asyncAfter(deadline: .now() + PushProvider.silenceTimeout, execute: work)
    }

    private func socketGone(_ current: Int, _ reason: String) {
        guard current == generation else { return }
        os_log("Stream disconnected: %{public}@", log: log, type: .info, reason)
        generation += 1
        watchdogWork?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        SessionMonitorShared.connected = false
        guard running else { return }
        let work = DispatchWorkItem { [weak self] in self?.connect() }
        reconnectWork = work
        queue.asyncAfter(deadline: .now() + reconnectDelay, execute: work)
        reconnectDelay = min(reconnectDelay * 2, PushProvider.reconnectMax)
    }

    // MARK: - events

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let message = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            return
        }
        switch message["kind"] as? String {
        case "hello":
            if let bootId = message["bootId"] as? String, bootId != SessionMonitorShared.bootId {
                // Daemon restarted: sequence numbers start over and it replays its new buffer.
                SessionMonitorShared.bootId = bootId
                SessionMonitorShared.lastSeq = 0
            }
        case "event":
            guard let event = message["event"] as? [String: Any],
                  let seq = (event["seq"] as? NSNumber)?.intValue,
                  seq > SessionMonitorShared.lastSeq else { return }
            SessionMonitorShared.lastSeq = seq
            SessionMonitorShared.lastEventAt = Date().timeIntervalSince1970 * 1000

            let severity = event["severity"] as? String ?? "info"
            guard !SessionMonitorShared.appInForeground,
                  SessionMonitorShared.severityRank(severity)
                    >= SessionMonitorShared.severityRank(string(SessionMonitorShared.configMinSeverity, "warning"))
            else { return }
            post(seq: seq,
                 severity: severity,
                 title: event["title"] as? String ?? "",
                 message: event["message"] as? String ?? "")
        default:
            break
        }
    }

    private func post(seq: Int, severity: String, title: String, message: String) {
        let content = UNMutableNotificationContent()
        content.title = title.isEmpty ? label("defaultTitle", "PINS") : title
        content.body = message
        content.threadIdentifier = "tns-rig"
        content.sound = SessionMonitorShared.severityRank(severity) >= 2 ? .default : nil
        let identifier = "tns-\(SessionMonitorShared.bootId ?? "rig")-\(seq)"
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request) { [log] error in
            if let error = error {
                os_log("Could not post notification: %{public}@", log: log, type: .error,
                       error.localizedDescription)
            }
        }
    }
}

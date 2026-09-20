import Foundation
import OSLog
import UIKit

/// A trace of what the television did, sent to the proxy.
///
/// There is no Mac here to read a television's console, and the fault that
/// asked for this — the menu opening and shutting again in one movement,
/// some of the time — never happens in the simulator. So the app writes
/// down what a debugger would watch: every move of focus (the class of the
/// view it left and reached, and its identifier when it has one), the
/// menu's selection, and the store's refreshes; and posts the lines to the
/// proxy every few seconds, where they land in one file per television.
///
/// Nothing personal goes: no name, no address, an anonymous id made once
/// per install. Without a proxy address — the simulator's test runs, the
/// bundled demo — the lines are still kept and written to the system log,
/// and never posted.
@MainActor
final class Diagnostics {
    static let shared = Diagnostics()
    private static let log = Logger(subsystem: "com.julienmalige.tvscores", category: "trace")

    private let endpoint: URL?
    private let device: String
    private var lines: [String] = []
    private var flushing = false
    private var observers: [NSObjectProtocol] = []
    private let started = Date()

    private init() {
        if case .remote(let base) = ScoreboardSource.resolve() {
            endpoint = base.appending(path: "v1/diag")
        } else {
            endpoint = nil
        }
        let defaults = UserDefaults.standard
        if let id = defaults.string(forKey: "diag.device") {
            device = id
        } else {
            let id = String(UUID().uuidString.prefix(8)).lowercased()
            defaults.set(id, forKey: "diag.device")
            device = id
        }
    }

    /// Start writing. Idempotent.
    func start() {
        guard observers.isEmpty else { return }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIFocusSystem.didUpdateNotification, object: nil, queue: .main) { [weak self] note in
            guard let context = note.userInfo?[UIFocusSystem.focusUpdateContextUserInfoKey] as? UIFocusUpdateContext else { return }
            let from = Self.describe(context.previouslyFocusedItem)
            let to = Self.describe(context.nextFocusedItem)
            let heading = context.focusHeading.words
            MainActor.assumeIsolated { self?.note("focus \(heading) \(from) -> \(to)") }
        })
        observers.append(center.addObserver(forName: UIFocusSystem.movementDidFailNotification, object: nil, queue: .main) { [weak self] note in
            guard let context = note.userInfo?[UIFocusSystem.focusUpdateContextUserInfoKey] as? UIFocusUpdateContext else { return }
            MainActor.assumeIsolated { self?.note("focus \(context.focusHeading.words) from \(Self.describe(context.previouslyFocusedItem)) went nowhere") }
        })
        for (name, word) in [(UIApplication.didBecomeActiveNotification, "active"), (UIApplication.willResignActiveNotification, "inactive"), (UIApplication.didEnterBackgroundNotification, "background")] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.note("app \(word)") }
            })
        }
        note("app launched, build \(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") ?? "?"), tvOS \(UIDevice.current.systemVersion)")
    }

    /// One line of the trace, stamped with the time since launch.
    func note(_ line: String) {
        let t = Date().timeIntervalSince(started)
        lines.append(String(format: "%9.3f %@", t, line))
        Self.log.debug("\(line, privacy: .public)")
        if lines.count > 400 { lines.removeFirst(lines.count - 400) }
        scheduleFlush()
    }

    private func scheduleFlush() {
        guard !flushing, endpoint != nil else { return }
        flushing = true
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(3))
            await self?.flush()
        }
    }

    private func flush() async {
        defer { flushing = false }
        guard let endpoint, !lines.isEmpty else { return }
        let batch = lines
        lines.removeAll()
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["device": device, "lines": batch])
        _ = try? await URLSession.shared.data(for: request)
    }

    /// A focus item named the way a person reads a stack: the class, and the
    /// accessibility identifier or label when the view carries one.
    private static func describe(_ item: (any UIFocusItem)?) -> String {
        guard let item else { return "nothing" }
        let name = String(describing: type(of: item))
            .replacingOccurrences(of: "SwiftUI.", with: "")
        var label = ""
        if let view = item as? UIView {
            label = view.accessibilityIdentifier ?? view.accessibilityLabel ?? ""
            if label.isEmpty, let id = Self.identifier(under: view) { label = id }
        }
        return label.isEmpty ? name : "\(name)[\(label)]"
    }

    /// The first identifier or label in the view's own subtree, two levels down.
    private static func identifier(under view: UIView, depth: Int = 0) -> String? {
        guard depth < 3 else { return nil }
        for sub in view.subviews {
            if let id = sub.accessibilityIdentifier ?? sub.accessibilityLabel, !id.isEmpty { return id }
            if let deeper = identifier(under: sub, depth: depth + 1) { return deeper }
        }
        return nil
    }
}

private extension UIFocusHeading {
    var words: String {
        var parts: [String] = []
        if contains(.up) { parts.append("up") }
        if contains(.down) { parts.append("down") }
        if contains(.left) { parts.append("left") }
        if contains(.right) { parts.append("right") }
        if contains(.next) { parts.append("next") }
        if contains(.previous) { parts.append("previous") }
        if contains(.first) { parts.append("first") }
        if contains(.last) { parts.append("last") }
        return parts.isEmpty ? "-" : parts.joined(separator: "+")
    }
}

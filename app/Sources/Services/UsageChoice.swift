import Foundation
import Observation

/// Whether the viewer shares how they use the app (Julien, 2026-11-14;
/// docs/analytics.md). Asked once, when the first board shows, and changed
/// in Settings, Privacy. Until the viewer says yes, nothing is sent and
/// Amplitude keeps nothing on the device (`Analytics`).
@MainActor
@Observable
final class UsageChoice {
    static let shared = UsageChoice()
    private static let key = "usageConsent"
    private static let sinceKey = "usageConsentDate"

    enum Answer: String {
        case unasked, granted, declined
    }

    private(set) var answer: Answer
    /// When the viewer said yes: one of the figures (`UsageProfile`).
    private(set) var since: Date?
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        answer = defaults.string(forKey: Self.key).flatMap(Answer.init(rawValue:)) ?? .unasked
        since = defaults.object(forKey: Self.sinceKey) as? Date
    }

    var shares: Bool { answer == .granted }

    func set(_ shares: Bool, now: Date = .now) {
        answer = shares ? .granted : .declined
        defaults.set(answer.rawValue, forKey: Self.key)
        since = shares ? now : nil
        if shares { defaults.set(now, forKey: Self.sinceKey) } else { defaults.removeObject(forKey: Self.sinceKey) }
    }

    /// Whether the question is due: once, on a device. The simulator — the
    /// flows, CI's pictures — is asked only when `-TVScoresAskConsent` says
    /// so, whatever it answered before.
    static func asks(_ answer: Answer, simulator: Bool, arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
        if arguments.contains("-TVScoresAskConsent") { return true }
        return !simulator && answer == .unasked
    }

    /// `-TVScoresReset` forgets the answer too, as `LeagueChoice` forgets the
    /// competitions: each flow, and CI's pictures, start unasked.
    static func resetIfAsked(_ defaults: UserDefaults = .standard, arguments: [String] = ProcessInfo.processInfo.arguments) {
        guard arguments.contains("-TVScoresReset") else { return }
        defaults.removeObject(forKey: key)
        defaults.removeObject(forKey: sinceKey)
    }
}

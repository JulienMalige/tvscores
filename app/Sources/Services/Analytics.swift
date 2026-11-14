import AmplitudeSwift
import Foundation
#if os(iOS)
import AmplitudeSwiftSessionReplayPlugin
#endif

/// Usage figures for Julien, sent to Amplitude only once the viewer has said
/// yes (`UsageChoice`; Julien, 2026-11-14; docs/analytics.md): the pages they
/// open and for how long, what they pick, and how they set the app up
/// (`UsageProfile`). Amplitude works out the city from the address the
/// events come from, and keeps that address.
///
/// The one service the app talks to besides the proxy. Its key is public, as
/// in every app that uses Amplitude: it only lets an app send events. Nothing
/// is made or stored before the yes, and nothing is ever sent from the
/// simulator — CI runs the app against the live proxy on every push. On an
/// iPhone or an iPad the screens of a visit are recorded too, for Amplitude's
/// Session Replay; the television has no replay.
@MainActor
final class Analytics {
    static let shared = Analytics()

    /// Never from the simulator: the flows, CI's pictures, a developer's runs.
    static let isSimulator: Bool = {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }()

    /// The project's key and data centre, from Info.plist (`app/project.yml`).
    private let project: (key: String, zone: String)?
    private var client: Amplitude?
    private let launched = Date()
    private var boardShown = false
    /// The competitions the board names, for the profile; kept from the last board.
    private var leagues: [LeagueSummary] = []

    private init(info: [String: Any] = Bundle.main.infoDictionary ?? [:]) {
        project = Self.project(info: info)
    }

    /// The key and the zone, when the build carries both: a setting left
    /// unexpanded, "$(AMPLITUDE_KEY)", sends nothing.
    nonisolated static func project(info: [String: Any]) -> (key: String, zone: String)? {
        guard let key = info["TVScoresAmplitudeKey"] as? String, key.count == 32, key.allSatisfy(\.isHexDigit),
              let zone = info["TVScoresAmplitudeZone"] as? String, ["US", "EU"].contains(zone) else { return nil }
        return (key, zone)
    }

    /// Whether events leave the device now; never in the simulator.
    var isSending: Bool { client.map { !$0.optOut } ?? false }

    /// At launch: a viewer who said yes before is counted from the first frame.
    func launch() {
        apply(UsageChoice.shared)
    }

    /// After an answer, to the question or in Settings: starts or stops.
    func apply(_ choice: UsageChoice, from origin: String? = nil) {
        guard choice.shares else {
            // A new random number if they say yes again: what was sent stays
            // apart from what comes after.
            client?.optOut = true
            client?.reset()
            return
        }
        let starting = client?.optOut ?? true
        start()
        if starting, let origin { track(.sharingStarted(from: origin)) }
    }

    private func start() {
        if let client {
            client.optOut = false
            return
        }
        guard !Self.isSimulator, let project else { return }
        let configuration = Configuration(
            apiKey: project.key,
            serverZone: ServerZone(rawValue: project.zone) ?? .US,
            // A random number per install rather than the vendor's identifier;
            // no carrier. The address stays: it is how Amplitude finds the city.
            trackingOptions: TrackingOptions().disableTrackIDFV().disableTrackCarrier(),
            // Sessions and their length, installs, updates and openings. The
            // pages and taps are ours (`UsageEvent`), not UIKit's guesses.
            autocapture: [.sessions, .appLifecycles],
            migrateLegacyData: false,
            // Only what this code says is collected: no switch on Amplitude's
            // side turns on more, and the library reports nothing of its own.
            enableAutoCaptureRemoteConfig: false,
            enableDiagnostics: false)
        let client = Amplitude(configuration: configuration)
        #if os(iOS)
        // Every visit recorded (the plugin records none by default), at its
        // default masking; the rate set here, not on Amplitude's site.
        client.add(plugin: AmplitudeSwiftSessionReplayPlugin(sampleRate: 1, enableRemoteConfig: false))
        #endif
        self.client = client
        refreshProfile()
    }

    func track(_ event: UsageEvent) {
        client?.track(eventType: event.name, eventProperties: event.properties, options: nil)
    }

    /// The setup as it now stands, after a change or a new board.
    func refreshProfile() {
        client?.identify(userProperties: UsageProfile.current(leagues: leagues).properties)
    }

    /// The board's competitions, kept for the profile.
    func boardChanged(leagues: [LeagueSummary]) {
        guard leagues != self.leagues else { return }
        self.leagues = leagues
        refreshProfile()
    }

    /// The first board of a launch is up: how long it took.
    func firstBoardShown(leagues: [LeagueSummary]) {
        boardChanged(leagues: leagues)
        guard !boardShown else { return }
        boardShown = true
        track(.boardShown(seconds: Date.now.timeIntervalSince(launched)))
    }

    func competitionOpened(_ league: LeagueSummary, day: Day, from origin: String) {
        track(.competitionOpened(.competition(LeagueRef(league), day: day), from: origin))
    }

    func gameOpened(_ event: Event, board: Scoreboard?, from origin: String) {
        track(.gameOpened(.game(event, league: board?.find(event.id)?.group.league), from: origin))
    }

    /// A choice in Settings, before and after; the profile follows it.
    func settingChanged(_ setting: String, item: String? = nil, from old: String, to new: String) {
        track(.settingChanged(setting: setting, item: item, old: old, new: new))
        refreshProfile()
    }
}

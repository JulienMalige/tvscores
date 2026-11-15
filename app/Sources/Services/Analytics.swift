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
@Observable
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
    @ObservationIgnored private var client: Amplitude?
    #if os(iOS)
    @ObservationIgnored private var replay: AmplitudeSwiftSessionReplayPlugin?
    #endif
    @ObservationIgnored private let launched = Date()
    @ObservationIgnored private var boardShown = false
    /// This device's person in iCloud, for Amplitude's user (`SharedPerson`).
    @ObservationIgnored private lazy var person = SharedPerson()
    /// The competitions the board names, for the profile; kept from the last board.
    @ObservationIgnored private var leagues: [LeagueSummary] = []

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

    /// Whether events leave the device now; never in the simulator. The
    /// pages watch it, to count from a yes and stop at a no (`UsageTracker`).
    private(set) var isSending = false

    /// At launch: a viewer who said yes before is counted from the first frame.
    func launch() {
        apply(UsageChoice.shared)
    }

    /// After an answer, to the question or in Settings: starts or stops.
    func apply(_ choice: UsageChoice, from origin: String? = nil) {
        guard choice.shares else {
            isSending = false
            // A new random number if they say yes again: what was sent stays
            // apart from what comes after.
            client?.optOut = true
            client?.reset()
            person.stop()
            #if os(iOS)
            // The recording stops with the rest, said here rather than left
            // to the plugin's reading of the opt-out.
            replay?.stop()
            #endif
            return
        }
        let starting = !isSending
        start()
        if starting, isSending, let origin { track(.sharingStarted(from: origin)) }
    }

    private func start() {
        if let client {
            client.optOut = false
            #if os(iOS)
            replay?.start()
            #endif
        } else {
            guard !Self.isSimulator, let project else { return }
            client = makeClient(project)
        }
        isSending = true
        // With every yes: after Off and On again the random number is new,
        // and it has no setup until it is sent.
        refreshProfile()
        joinPerson()
    }

    /// The user Amplitude files this device under: the person's number in
    /// this Apple ID's iCloud, so one person's Apple TV, iPhone and iPad
    /// count once (`SharedPerson`). Joined again after every yes.
    private func joinPerson() {
        person.changed = { [weak self] id in self?.client?.setUserId(userId: id) }
        person.join()
    }

    private func makeClient(_ project: (key: String, zone: String)) -> Amplitude {
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
        let replay = AmplitudeSwiftSessionReplayPlugin(sampleRate: 1, enableRemoteConfig: false)
        client.add(plugin: replay)
        self.replay = replay
        #endif
        return client
    }

    func track(_ event: UsageEvent) {
        client?.track(eventType: event.name, eventProperties: event.properties, options: nil)
    }

    /// The setup as it now stands, after a change or a new board; not before
    /// the first board, which names the competitions followed.
    func refreshProfile() {
        guard let client, !leagues.isEmpty else { return }
        client.identify(userProperties: UsageProfile.current(leagues: leagues).properties)
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

    /// A competition opened, by its menu key, from the menu or the front page.
    func competitionOpened(_ key: String, day: Day, from origin: String) {
        guard let league = leagues.first(where: { MenuItem.key($0) == key }) else { return }
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

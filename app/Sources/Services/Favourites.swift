import Foundation
import Observation

/// The teams, drivers, riders and players the viewer follows (My Teams,
/// docs/roadmap.md §4; Julien, 2026-11-15). Each is the proxy's key,
/// "football:paris-saint-germain", "f1:k-antonelli" (`proxy/src/teams.js`),
/// with the name it had when it was starred, for the lists that show it
/// without the board.
///
/// Kept on the device and in the viewer's iCloud key-value store, so a team
/// starred on the Apple TV is starred on their iPhone too (Julien,
/// 2026-11-15: "iCloud sync, yes"). Nothing about it reaches the proxy.
@MainActor
@Observable
final class Favourites {
    static let shared = Favourites()
    static let storeKey = "favourites"

    /// Key → name.
    private(set) var followed: [String: String]
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let cloud: NSUbiquitousKeyValueStore?

    init(defaults: UserDefaults = .standard, cloud: NSUbiquitousKeyValueStore? = .default) {
        self.defaults = defaults
        self.cloud = cloud
        followed = (defaults.dictionary(forKey: Self.storeKey) as? [String: String]) ?? [:]
        guard let cloud else { return }
        // What another device of the same Apple ID starred, now and later.
        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                               object: cloud, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.takeCloud() }
        }
        cloud.synchronize()
        takeCloud()
    }

    /// `-TVScoresReset` forgets them, as it does the other choices; then
    /// `-TVScoresFollow football:paris-saint-germain,rugby:stade-toulousain`
    /// stars those (CI's pictures and the flows).
    static func prepareIfAsked(_ defaults: UserDefaults = .standard, arguments: [String] = ProcessInfo.processInfo.arguments) {
        if arguments.contains("-TVScoresReset") { defaults.removeObject(forKey: storeKey) }
        guard let i = arguments.firstIndex(of: "-TVScoresFollow"), i + 1 < arguments.count else { return }
        let keys = arguments[i + 1].split(separator: ",").map(String.init)
        defaults.set(Dictionary(keys.map { ($0, Favourites.nameOf($0)) }, uniquingKeysWith: { a, _ in a }), forKey: storeKey)
    }

    var isEmpty: Bool { followed.isEmpty }

    func isFollowed(_ key: String?) -> Bool {
        guard let key else { return false }
        return followed[key] != nil
    }

    func toggle(_ key: String, name: String) {
        let was = isFollowed(key)
        if was { followed[key] = nil } else { followed[key] = name }
        save()
        Analytics.shared.settingChanged("team", item: key, from: was ? "followed" : "not followed", to: was ? "not followed" : "followed")
    }

    /// The sports with a driver, a rider or a player followed: all their races are the viewer's.
    var raceSports: Set<String> {
        Set(followed.keys.compactMap { key in
            let sport = String(key.split(separator: ":").first ?? "")
            return ["f1", "motogp"].contains(sport) ? sport : nil
        })
    }

    /// A game one of whose sides is followed, or a race of a series one of
    /// whose drivers or riders is.
    func follows(_ event: Event) -> Bool {
        switch event.kind {
        case .match: isFollowed(event.home?.followKey(event.sport)) || isFollowed(event.away?.followKey(event.sport))
        case .race: raceSports.contains(event.sport)
        }
    }

    /// The day's games of the followed, in kickoff order, each with its
    /// competition for the grey line over it.
    func games(in groups: [LeagueGroup]) -> [(group: LeagueGroup, event: Event)] {
        var seen = Set<String>()
        return groups.flatMap { group in group.events.filter(follows).map { (group: group, event: $0) } }
            .filter { seen.insert($0.event.id).inserted }
            .sorted { $0.event.start < $1.event.start }
    }

    private func save() {
        defaults.set(followed, forKey: Self.storeKey)
        cloud?.set(followed, forKey: Self.storeKey)
    }

    /// iCloud's copy wins: it is the last change made on any of the viewer's devices.
    private func takeCloud() {
        guard let remote = cloud?.dictionary(forKey: Self.storeKey) as? [String: String], remote != followed else { return }
        followed = remote
        defaults.set(remote, forKey: Self.storeKey)
    }

    /// A readable name from a key, when only the key is known: "paris saint germain".
    static func nameOf(_ key: String) -> String {
        String(key.split(separator: ":").dropFirst().joined(separator: ":")).replacingOccurrences(of: "-", with: " ").capitalized
    }
}

extension TeamRef {
    /// The proxy's key for this side; a board from before it wrote keys
    /// (the bundled sample) derives the same from the name.
    func followKey(_ sport: String) -> String? { key ?? Self.derivedKey(sport, name) }

    /// `proxy/src/teams.js`'s `teamKey`, for boards without keys only.
    static func derivedKey(_ sport: String, _ name: String) -> String? {
        let folded = name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX")).lowercased()
        let slug = folded.split(whereSeparator: { !($0.isASCII && ($0.isLetter || $0.isNumber)) }).joined(separator: "-")
        return slug.isEmpty ? nil : "\(sport):\(slug)"
    }
}

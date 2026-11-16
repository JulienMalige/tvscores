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
/// In iCloud each favourite is an entry of its own, "fav.<key>", so two
/// devices starring different sides at once both keep theirs: a star or an
/// unstar from elsewhere changes that one entry, never the whole list.
@MainActor
@Observable
final class Favourites {
    static let shared = Favourites(cloud: usesCloud() ? .default : nil)
    static let storeKey = "favourites"
    private static let cloudPrefix = "fav."

    /// Key → name.
    private(set) var followed: [String: String] { didSet { indexed() } }
    /// The sports with a driver, a rider or a player followed: all their
    /// races are the viewer's. Kept with `followed`, read for every row.
    private(set) var raceSports: Set<String> = []
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let cloud: NSUbiquitousKeyValueStore?

    init(defaults: UserDefaults = .standard, cloud: NSUbiquitousKeyValueStore? = nil) {
        self.defaults = defaults
        self.cloud = cloud
        followed = (defaults.dictionary(forKey: Self.storeKey) as? [String: String]) ?? [:]
        indexed()
        guard let cloud else { return }
        // What another device of the same Apple ID starred or unstarred, now and later.
        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                               object: cloud, queue: .main) { [weak self] note in
            let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]
            MainActor.assumeIsolated { self?.takeCloud(keys) }
        }
        cloud.synchronize()
        // Those in iCloud join those kept here: a star made while iCloud was
        // out of reach is not lost to an older copy.
        takeCloud(nil)
    }

    /// A launch that resets or sets the favourites (`-TVScoresReset`,
    /// `-TVScoresFollow`: the flows, CI's pictures) leaves iCloud alone, or
    /// its copy would come back over what the launch asked for.
    static func usesCloud(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
        !arguments.contains("-TVScoresReset") && !arguments.contains("-TVScoresFollow")
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
        followed[key] = was ? nil : name
        defaults.set(followed, forKey: Self.storeKey)
        if was { cloud?.removeObject(forKey: Self.cloudPrefix + key) } else { cloud?.set(name, forKey: Self.cloudPrefix + key) }
        Analytics.shared.settingChanged("team", item: key, from: was ? "followed" : "not followed", to: was ? "not followed" : "followed")
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
        guard !followed.isEmpty else { return [] }
        var seen = Set<String>()
        return groups.flatMap { group in group.events.filter(follows).map { (group: group, event: $0) } }
            .filter { seen.insert($0.event.id).inserted }
            .sorted { $0.event.start < $1.event.start }
    }

    private func indexed() {
        let sports = Set(followed.keys.compactMap { $0.split(separator: ":").first.map(String.init) })
        let races = sports.intersection(["f1", "motogp"])
        if races != raceSports { raceSports = races }
    }

    /// iCloud's entries into the list: all of them on launch, which only
    /// add; or the ones another device changed, which add or remove.
    private func takeCloud(_ changed: [String]?) {
        guard let cloud else { return }
        var next = followed
        if let changed {
            for entry in changed where entry.hasPrefix(Self.cloudPrefix) {
                next[String(entry.dropFirst(Self.cloudPrefix.count))] = cloud.string(forKey: entry)
            }
        } else {
            for (entry, value) in cloud.dictionaryRepresentation where entry.hasPrefix(Self.cloudPrefix) {
                if let name = value as? String { next[String(entry.dropFirst(Self.cloudPrefix.count))] = name }
            }
        }
        guard next != followed else { return }
        followed = next
        defaults.set(next, forKey: Self.storeKey)
    }

    /// A readable name from a key, when only the key is known: "Paris Saint Germain".
    static func nameOf(_ key: String) -> String {
        String(key.split(separator: ":").dropFirst().joined(separator: ":")).replacingOccurrences(of: "-", with: " ").capitalized
    }
}

extension TeamRef {
    /// The proxy's key for this side; a board from before it wrote keys
    /// (the bundled sample) derives the same from the name.
    func followKey(_ sport: String) -> String? { key ?? Self.derivedKey(sport, name) }

    /// `proxy/src/teams.js`'s `teamKey`, step for step, for boards without
    /// keys only: compatibility decomposition, the combining accents
    /// (U+0300 to U+036F) dropped, lower case, then every run of anything
    /// but a to z and 0 to 9 one hyphen. "ø" is not an accented "o" there,
    /// so it is not here either: "Bodø/Glimt" is "bod-glimt" on both sides.
    static func derivedKey(_ sport: String, _ name: String) -> String? {
        let scalars = name.decomposedStringWithCompatibilityMapping.unicodeScalars.filter { !(0x300...0x36F).contains($0.value) }
        let folded = String(String.UnicodeScalarView(scalars)).lowercased()
        let slug = folded.split(whereSeparator: { !(("a"..."z").contains($0) || ("0"..."9").contains($0)) }).joined(separator: "-")
        return slug.isEmpty ? nil : "\(sport):\(slug)"
    }
}

import Foundation

/// The choices in Settings that follow the viewer from one device to the
/// next, through their iCloud (Julien, 2026-11-17): the competitions shown
/// and their order, the countries whose channels are shown, and the apps
/// How to Watch may offer. The language stays each device's own (a living
/// room's television can speak another language than a phone), and so does
/// the answer about sharing usage, which each device gives for itself.
///
/// Each choice keeps its key in the device's settings, where its store
/// reads it, and the same key in iCloud's key-value store. At launch,
/// before any store reads: iCloud's copy wins where there is one, and a
/// device's own goes up where iCloud has none. Then a change made here goes
/// up as it is saved, and one made on another device comes down and its
/// store reads it again.
@MainActor
final class SettingsSync {
    static let shared = SettingsSync()

    /// The keys that travel, each a list of strings.
    static let keys = [LeagueChoice.hiddenKey, LeagueChoice.orderKey, ChannelChoice.key, AppChoice.key]

    private let defaults: UserDefaults
    private let cloud: PersonStore & ArrayStore
    private var observers: [NSObjectProtocol] = []

    init(defaults: UserDefaults = .standard, cloud: PersonStore & ArrayStore = NSUbiquitousKeyValueStore.default) {
        self.defaults = defaults
        self.cloud = cloud
    }

    /// The launches that set their own choices (the flows, CI's pictures,
    /// the demo) leave iCloud alone, as `Favourites` does.
    static func usesCloud(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
        Favourites.usesCloud(arguments) && !arguments.contains("-TVScoresDemo")
    }

    /// At launch, before the stores read their choices.
    func start() {
        guard observers.isEmpty else { return }
        cloud.synchronize()
        for key in Self.keys {
            if let shared = cloud.strings(forKey: key) { defaults.set(shared, forKey: key) }
            else if let mine = defaults.stringArray(forKey: key) { cloud.set(mine, forKey: key) }
        }
        // A choice saved here goes up.
        observers.append(NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: defaults, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.sendChanged() }
        })
        // One made elsewhere comes down.
        if let store = cloud as? NSUbiquitousKeyValueStore {
            observers.append(NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: store, queue: .main) { [weak self] note in
                let changed = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
                MainActor.assumeIsolated { self?.received(changed) }
            })
        }
    }

    /// The keys whose value here differs from iCloud's go up.
    func sendChanged() {
        for key in Self.keys {
            let mine = defaults.stringArray(forKey: key)
            guard let mine, mine != cloud.strings(forKey: key) else { continue }
            cloud.set(mine, forKey: key)
        }
    }

    /// Another device's choices, into this one's settings and its stores.
    func received(_ changed: [String]) {
        let ours = changed.filter(Self.keys.contains)
        guard !ours.isEmpty else { return }
        for key in ours {
            if let shared = cloud.strings(forKey: key) { defaults.set(shared, forKey: key) }
        }
        LeagueChoice.shared.reload()
        ChannelChoice.shared.reload()
        AppChoice.shared.reload()
    }
}

/// A list of strings from iCloud's key-value store, or a test's stand-in.
protocol ArrayStore: AnyObject {
    func strings(forKey key: String) -> [String]?
}

extension NSUbiquitousKeyValueStore: ArrayStore {
    func strings(forKey key: String) -> [String]? { (object(forKey: key) as? [Any])?.compactMap { $0 as? String } }
}

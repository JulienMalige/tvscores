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
/// before any store reads, iCloud's copy wins where there is one; a device's
/// own goes up where iCloud has none, but only once iCloud has been heard
/// from, since an empty store may just not have synced yet. Then a change
/// the viewer makes here goes up as its store saves it, and one made on
/// another device comes down and its store reads it again. Each key is a
/// whole list: two devices changing the same list at the same moment keep
/// the later one, a rare case for choices made by hand in Settings.
@MainActor
final class SettingsSync {
    static let shared = SettingsSync()

    /// The keys that travel, each a list of strings.
    static let keys = [LeagueChoice.hiddenKey, LeagueChoice.orderKey, ChannelChoice.key, AppChoice.key]

    /// How long a launch waits for iCloud's first sync before it fills an
    /// empty iCloud with this device's choices.
    static let firstSync: Duration = .seconds(15)

    private let defaults: UserDefaults
    private let cloud: PersonStore & ArrayStore
    private let wait: Duration
    private var observer: NSObjectProtocol?
    /// Whether iCloud has been heard from, or waited for: until then an
    /// empty iCloud may only be not synced yet, and nothing goes up.
    private(set) var settled = false
    /// Told the keys that came down from another device.
    var reload: ([String]) -> Void = { keys in
        if keys.contains(where: [LeagueChoice.hiddenKey, LeagueChoice.orderKey].contains) { LeagueChoice.shared.reload() }
        if keys.contains(ChannelChoice.key) { ChannelChoice.shared.reload() }
        if keys.contains(AppChoice.key) { AppChoice.shared.reload() }
    }

    init(defaults: UserDefaults = .standard, cloud: PersonStore & ArrayStore = NSUbiquitousKeyValueStore.default,
         wait: Duration = SettingsSync.firstSync) {
        self.defaults = defaults
        self.cloud = cloud
        self.wait = wait
    }

    /// The launches that set their own choices (the flows, CI's pictures,
    /// the demo) leave iCloud alone, as `Favourites` does.
    static func usesCloud(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Bool {
        Favourites.usesCloud(arguments) && !arguments.contains("-TVScoresDemo")
    }

    private var started = false

    /// At launch, before the stores read their choices: what iCloud already
    /// holds comes down; this device's own go up only once iCloud is heard
    /// from, or after `firstSync`, and only where iCloud has none.
    func start() {
        guard !started else { return }
        started = true
        cloud.synchronize()
        _ = take(Self.keys)
        if let store = cloud as? NSUbiquitousKeyValueStore {
            observer = NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: store, queue: .main) { [weak self] note in
                let changed = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
                MainActor.assumeIsolated { self?.received(changed) }
            }
        }
        Task { [weak self, wait] in
            try? await Task.sleep(for: wait)
            self?.settle()
        }
    }

    /// iCloud has had its chance: this device's choices fill what it lacks.
    func settle() {
        guard !settled else { return }
        settled = true
        for key in Self.keys where cloud.strings(forKey: key) == nil {
            if let mine = defaults.stringArray(forKey: key) { cloud.set(mine, forKey: key) }
        }
    }

    /// A store saved a choice the viewer made here: it goes up. Before iCloud
    /// is heard from it waits, and goes up with the rest at `settle`.
    func saved(_ key: String) {
        guard started, settled, Self.keys.contains(key), let mine = defaults.stringArray(forKey: key),
              mine != cloud.strings(forKey: key) else { return }
        cloud.set(mine, forKey: key)
    }

    /// Another device's choices, into this one's settings and their stores.
    func received(_ changed: [String]) {
        let moved = take(changed.filter(Self.keys.contains))
        settle()
        if !moved.isEmpty { reload(moved) }
    }

    /// iCloud's values for these keys into the device's settings; the keys
    /// whose value changed here.
    private func take(_ keys: [String]) -> [String] {
        keys.filter { key in
            guard let shared = cloud.strings(forKey: key), shared != defaults.stringArray(forKey: key) else { return false }
            defaults.set(shared, forKey: key)
            return true
        }
    }
}

/// A list of strings from iCloud's key-value store, or a test's stand-in.
protocol ArrayStore: AnyObject {
    func strings(forKey key: String) -> [String]?
}

extension NSUbiquitousKeyValueStore: ArrayStore {
    func strings(forKey key: String) -> [String]? { (object(forKey: key) as? [Any])?.compactMap { $0 as? String } }
}

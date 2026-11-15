import Foundation

/// The little of `NSUbiquitousKeyValueStore` a shared person needs, so a
/// test can stand in for iCloud.
protocol PersonStore: AnyObject {
    func string(forKey key: String) -> String?
    func set(_ value: Any?, forKey key: String)
    @discardableResult func synchronize() -> Bool
}

extension NSUbiquitousKeyValueStore: PersonStore {}

/// One person's Apple TV, iPhone and iPad, counted as one in Amplitude
/// (Julien, 2026-11-15: "when it joins the iCloud, we can use this device
/// ID to understand that all these devices, in fact, are the same iCloud
/// user"). The Apple ID's iCloud key-value store holds one random number
/// for the person; every device of that Apple ID that shares its usage
/// gives Amplitude that number as its user, and Amplitude files the devices
/// under one person.
///
/// A device never writes over a number already there: it takes what iCloud
/// holds, and makes one only when iCloud still has none once it has had
/// time to sync. Two devices making one at the same moment converge, since
/// iCloud keeps one value and tells every device which. The number is the
/// person's, not a device's, so a device that stops sharing leaves nothing
/// of itself behind. Only for viewers who said yes (`Analytics` joins after
/// the yes and stops at a no), only between devices on the same Apple ID
/// with iCloud on, and nothing on screen.
@MainActor
final class SharedPerson {
    static let storeKey = "person"
    /// How long a device with no number in iCloud waits for the first sync
    /// before it makes one.
    static let firstSync: Duration = .seconds(15)

    private let store: PersonStore
    private let wait: Duration
    private let makeId: () -> String
    private var observer: NSObjectProtocol?
    private var waiting: Task<Void, Never>?
    /// The number last handed to `changed`; nil while not joined.
    private(set) var person: String?
    /// Told the person's number when joining, and whenever iCloud changes it.
    var changed: (String) -> Void = { _ in }

    init(store: PersonStore = NSUbiquitousKeyValueStore.default, wait: Duration = SharedPerson.firstSync,
         makeId: @escaping () -> String = { UUID().uuidString.lowercased() }) {
        self.store = store
        self.wait = wait
        self.makeId = makeId
    }

    /// Valid as Amplitude's user: five characters at least.
    nonisolated static func valid(_ id: String?) -> String? {
        guard let id, id.count >= 5 else { return nil }
        return id
    }

    /// After a yes: this device's person, told through `changed` even when
    /// it is the one it had before a no.
    func join() {
        person = nil
        joined = true
        if observer == nil, let cloud = store as? NSUbiquitousKeyValueStore {
            observer = NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                                              object: cloud, queue: .main) { [weak self] note in
                let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
                guard keys.contains(SharedPerson.storeKey) else { return }
                MainActor.assumeIsolated { self?.cloudChanged() }
            }
        }
        store.synchronize()
        if adoptStored() { return }
        waiting?.cancel()
        waiting = Task { [weak self, wait] in
            try? await Task.sleep(for: wait)
            guard !Task.isCancelled, let self, self.joined else { return }
            if !self.adoptStored() {
                let id = self.makeId()
                self.store.set(id, forKey: Self.storeKey)
                self.apply(id)
            }
        }
    }

    /// After a no: nothing more read, written or told.
    func stop() {
        waiting?.cancel()
        waiting = nil
        if let observer { NotificationCenter.default.removeObserver(observer) }
        observer = nil
        person = nil
        joined = false
    }

    /// iCloud brought another device's number: it is the person's now.
    func cloudChanged() {
        guard joined else { return }
        waiting?.cancel()
        _ = adoptStored()
    }

    /// Between a yes and a no.
    private var joined = false

    private func adoptStored() -> Bool {
        guard let id = Self.valid(store.string(forKey: Self.storeKey)) else { return false }
        apply(id)
        return true
    }

    private func apply(_ id: String) {
        guard id != person else { return }
        person = id
        changed(id)
    }
}

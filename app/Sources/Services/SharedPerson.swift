import Foundation

/// One person's Apple TV, iPhone and iPad, counted as one in Amplitude
/// (Julien, 2026-11-15: "when it joins the iCloud, we can use this device
/// ID to understand that all these devices, in fact, are the same iCloud
/// user"). The first device of an Apple ID to share its usage writes its own
/// Amplitude device number into that Apple ID's iCloud key-value store; every
/// device that shares then gives Amplitude that number as its user, and
/// Amplitude files the devices under one person.
///
/// Only for viewers who said yes (`Analytics` asks for it after the yes),
/// only between devices on the same Apple ID with iCloud on, and nothing on
/// screen. Two devices sharing for the first time before iCloud has synced
/// each write theirs; the older one wins as soon as each sees the other's.
@MainActor
final class SharedPerson {
    static let storeKey = "person"

    struct Entry: Equatable {
        let id: String
        /// When it was written: the older entry is the one kept.
        let since: Double

        init(id: String, since: Double) {
            self.id = id
            self.since = since
        }

        init?(_ stored: Any?) {
            guard let dict = stored as? [String: Any], let id = dict["id"] as? String, id.count >= 5,
                  let since = dict["since"] as? Double else { return nil }
            self.init(id: id, since: since)
        }

        var stored: [String: Any] { ["id": id, "since": since] }
    }

    /// What this device goes by, given what iCloud holds: the stored person
    /// when there is one and it is older; else this device, to be written.
    nonisolated static func pick(stored: Entry?, mine: Entry) -> (person: Entry, write: Bool) {
        guard let stored else { return (mine, true) }
        if stored.since <= mine.since || stored.id == mine.id { return (stored, false) }
        return (mine, true)
    }

    private let cloud: NSUbiquitousKeyValueStore
    private var observer: NSObjectProtocol?
    /// This device's entry, the first time it was asked: its number and when.
    private var mine: Entry?
    private(set) var person: Entry?
    /// Told whenever the person changes: at the start, and if an older
    /// device's entry arrives from iCloud later.
    var changed: (String) -> Void = { _ in }

    init(cloud: NSUbiquitousKeyValueStore = .default) {
        self.cloud = cloud
    }

    /// Joins this device to its person: `deviceId` is Amplitude's number for it.
    func join(deviceId: String, now: Date = .now) {
        if mine?.id != deviceId { mine = Entry(id: deviceId, since: now.timeIntervalSince1970) }
        if observer == nil {
            observer = NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                                                              object: cloud, queue: .main) { [weak self] note in
                let keys = note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
                guard keys.contains(SharedPerson.storeKey) else { return }
                MainActor.assumeIsolated { self?.settle() }
            }
        }
        cloud.synchronize()
        settle()
    }

    private func settle() {
        guard let mine else { return }
        let (person, write) = Self.pick(stored: Entry(cloud.object(forKey: Self.storeKey)), mine: mine)
        if write { cloud.set(person.stored, forKey: Self.storeKey) }
        guard person != self.person else { return }
        self.person = person
        changed(person.id)
    }
}

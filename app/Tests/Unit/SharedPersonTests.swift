import Foundation
import Testing
@testable import TVScores

/// One person's devices, joined through iCloud (`SharedPerson`).
@Suite("Shared person")
@MainActor
struct SharedPersonTests {
    /// iCloud's key-value store, as a dictionary.
    final class FakeStore: PersonStore {
        var values: [String: Any] = [:]
        func string(forKey key: String) -> String? { values[key] as? String }
        func set(_ value: Any?, forKey key: String) { values[key] = value }
        func synchronize() -> Bool { true }
    }

    private func person(_ store: FakeStore, told: @escaping (String) -> Void) -> SharedPerson {
        let p = SharedPerson(store: store, wait: .milliseconds(20), makeId: { "new-person-id" })
        p.changed = told
        return p
    }

    @Test("a device takes the number iCloud holds, and writes nothing over it")
    func takesWhatIsThere() {
        let store = FakeStore()
        store.values[SharedPerson.storeKey] = "tv-person-1"
        var told: [String] = []
        person(store) { told.append($0) }.join()
        #expect(told == ["tv-person-1"])
        #expect(store.string(forKey: SharedPerson.storeKey) == "tv-person-1")
    }

    @Test("with nothing in iCloud after the first sync, the first device makes the number")
    func firstDeviceMakesIt() async throws {
        let store = FakeStore()
        var told: [String] = []
        // Held, as `Analytics` holds it: the wait is let go with its owner.
        let p = person(store) { told.append($0) }
        p.join()
        #expect(told.isEmpty, "not before iCloud has had time to sync")
        try await Task.sleep(for: .milliseconds(200))
        withExtendedLifetime(p) {}
        #expect(told == ["new-person-id"])
        #expect(store.string(forKey: SharedPerson.storeKey) == "new-person-id")
    }

    @Test("another device's number arriving from iCloud is taken, and none is made")
    func syncArrivesFirst() async throws {
        let store = FakeStore()
        var told: [String] = []
        let p = person(store) { told.append($0) }
        p.join()
        store.values[SharedPerson.storeKey] = "phone-person-2"
        p.cloudChanged()
        try await Task.sleep(for: .milliseconds(200))
        #expect(told == ["phone-person-2"])
        #expect(store.string(forKey: SharedPerson.storeKey) == "phone-person-2")
    }

    @Test("after a no nothing is told; after a yes again the same person is told again")
    func offAndOn() {
        let store = FakeStore()
        store.values[SharedPerson.storeKey] = "tv-person-1"
        var told: [String] = []
        let p = person(store) { told.append($0) }
        p.join()
        p.stop()
        store.values[SharedPerson.storeKey] = "other-person-3"
        p.cloudChanged()
        #expect(told == ["tv-person-1"], "a no hears nothing more")
        p.join()
        #expect(told == ["tv-person-1", "other-person-3"], "Amplitude's reset cleared the user: it is set again")
        p.stop()
        p.join()
        #expect(told == ["tv-person-1", "other-person-3", "other-person-3"], "the same person, told again after Off and On")
    }

    @Test("a number too short for Amplitude is not one")
    func validity() {
        #expect(SharedPerson.valid("abcde") == "abcde")
        #expect(SharedPerson.valid("ab") == nil)
        #expect(SharedPerson.valid(nil) == nil)
    }
}

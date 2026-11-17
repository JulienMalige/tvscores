import Foundation
import Testing
@testable import TVScores

/// Settings' choices through iCloud (`SettingsSync`).
@Suite("Settings sync")
@MainActor
struct SettingsSyncTests {
    /// iCloud's key-value store, as a dictionary.
    final class FakeCloud: PersonStore, ArrayStore {
        var values: [String: Any] = [:]
        func string(forKey key: String) -> String? { values[key] as? String }
        func strings(forKey key: String) -> [String]? { values[key] as? [String] }
        func set(_ value: Any?, forKey key: String) { values[key] = value }
        func synchronize() -> Bool { true }
    }

    private func defaults() -> UserDefaults { UserDefaults(suiteName: "settings-sync-\(UUID().uuidString)")! }

    @Test("at launch iCloud's choices win; a device's own go up where iCloud has none; the language stays")
    func launch() {
        let cloud = FakeCloud()
        cloud.values[ChannelChoice.key] = ["BR"]
        let local = defaults()
        local.set(["FR", "US"], forKey: ChannelChoice.key)
        local.set(["dazn"], forKey: AppChoice.key)
        local.set("fr", forKey: "appLanguage")
        SettingsSync(defaults: local, cloud: cloud).start()
        #expect(local.stringArray(forKey: ChannelChoice.key) == ["BR"], "the countries chosen on another device")
        #expect(cloud.values[AppChoice.key] as? [String] == ["dazn"], "the apps hidden here go up")
        #expect(cloud.values["appLanguage"] == nil, "the language is each device's own")
        #expect(cloud.values["usageConsent"] == nil)
    }

    @Test("a choice saved here goes up; one made elsewhere comes down")
    func both() {
        let cloud = FakeCloud()
        let local = defaults()
        let sync = SettingsSync(defaults: local, cloud: cloud)
        local.set(["nfl:4391"], forKey: LeagueChoice.hiddenKey)
        sync.sendChanged()
        #expect(cloud.values[LeagueChoice.hiddenKey] as? [String] == ["nfl:4391"])
        cloud.values[LeagueChoice.orderKey] = ["football:4334", "football:4328"]
        sync.received([LeagueChoice.orderKey, "favourites"])
        #expect(local.stringArray(forKey: LeagueChoice.orderKey) == ["football:4334", "football:4328"])
    }

    @Test("the demo, the flows and CI's pictures leave iCloud alone")
    func launchesThatSetTheirOwn() {
        #expect(SettingsSync.usesCloud([]))
        #expect(!SettingsSync.usesCloud(["-TVScoresDemo"]))
        #expect(!SettingsSync.usesCloud(["-TVScoresReset"]))
    }
}

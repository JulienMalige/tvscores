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

    @Test("at launch iCloud's choices come down; a device's own go up only once iCloud is heard from; the language stays")
    func launch() {
        let cloud = FakeCloud()
        cloud.values[ChannelChoice.key] = ["BR"]
        let local = defaults()
        local.set(["FR", "US"], forKey: ChannelChoice.key)
        local.set(["dazn"], forKey: AppChoice.key)
        local.set("fr", forKey: "appLanguage")
        let sync = SettingsSync(defaults: local, cloud: cloud, wait: .seconds(60))
        sync.start()
        #expect(local.stringArray(forKey: ChannelChoice.key) == ["BR"], "the countries chosen on another device")
        #expect(cloud.values[AppChoice.key] == nil, "an empty iCloud may only be not synced yet: nothing goes up")
        sync.settle()
        #expect(cloud.values[AppChoice.key] as? [String] == ["dazn"], "then the apps hidden here fill it")
        #expect(cloud.values[ChannelChoice.key] as? [String] == ["BR"], "and nothing iCloud had is written over")
        #expect(cloud.values["appLanguage"] == nil, "the language is each device's own")
    }

    @Test("a change made here goes up once settled; one made elsewhere comes down and only its store reloads")
    func both() {
        let cloud = FakeCloud()
        let local = defaults()
        let sync = SettingsSync(defaults: local, cloud: cloud, wait: .seconds(60))
        var reloaded: [[String]] = []
        sync.reload = { reloaded.append($0) }
        sync.start()
        local.set(["nfl:4391"], forKey: LeagueChoice.hiddenKey)
        sync.saved(LeagueChoice.hiddenKey)
        #expect(cloud.values[LeagueChoice.hiddenKey] == nil, "not before iCloud is heard from")
        cloud.values[LeagueChoice.orderKey] = ["football:4334", "football:4328"]
        sync.received([LeagueChoice.orderKey, "favourites"])
        #expect(local.stringArray(forKey: LeagueChoice.orderKey) == ["football:4334", "football:4328"])
        #expect(reloaded == [[LeagueChoice.orderKey]], "only the store whose choice changed")
        #expect(cloud.values[LeagueChoice.hiddenKey] as? [String] == ["nfl:4391"], "heard from: what waited goes up")
        local.set(["nba:4387"], forKey: LeagueChoice.hiddenKey)
        sync.saved(LeagueChoice.hiddenKey)
        #expect(cloud.values[LeagueChoice.hiddenKey] as? [String] == ["nba:4387"])
        sync.received([LeagueChoice.orderKey])
        #expect(reloaded.count == 1, "the same value again reloads nothing")
    }

    @Test("the demo, the flows and CI's pictures leave iCloud alone")
    func launchesThatSetTheirOwn() {
        #expect(SettingsSync.usesCloud([]))
        #expect(!SettingsSync.usesCloud(["-TVScoresDemo"]))
        #expect(!SettingsSync.usesCloud(["-TVScoresReset"]))
    }
}

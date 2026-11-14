import Foundation
import Testing
@testable import TVScores

/// The usage figures (docs/analytics.md): asked once, sent only after a yes
/// and never from the simulator, and saying exactly what the privacy page
/// says they say.
@Suite("Usage")
struct UsageTests {
    private static func sample(_ name: String) throws -> Data {
        let url = try #require(Bundle.main.url(forResource: name, withExtension: "json"))
        return try Data(contentsOf: url)
    }

    @Test("unasked at first; a yes is kept with its date, a no forgets the date")
    @MainActor
    func answerIsKept() throws {
        let name = "UsageTests.answer"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        let choice = UsageChoice(defaults: defaults)
        #expect(choice.answer == .unasked && !choice.shares)
        let day = Date(timeIntervalSince1970: 1_800_000_000)
        choice.set(true, now: day)
        #expect(UsageChoice(defaults: defaults).answer == .granted, "kept for the next launch")
        #expect(UsageChoice(defaults: defaults).since == day)
        choice.set(false)
        #expect(UsageChoice(defaults: defaults).answer == .declined)
        #expect(UsageChoice(defaults: defaults).since == nil)
    }

    @Test("asked once on a device; in the simulator only when a flow or CI asks for it")
    @MainActor
    func askedOnce() {
        #expect(UsageChoice.asks(.unasked, simulator: false, arguments: []))
        #expect(!UsageChoice.asks(.granted, simulator: false, arguments: []))
        #expect(!UsageChoice.asks(.declined, simulator: false, arguments: []))
        #expect(!UsageChoice.asks(.unasked, simulator: true, arguments: []), "the flows and CI's pictures go unasked")
        #expect(UsageChoice.asks(.declined, simulator: true, arguments: ["-TVScoresAskConsent"]), "unless they ask")
    }

    @Test("the flows' reset forgets the answer, and only when asked")
    @MainActor
    func resetForgetsTheAnswer() throws {
        let name = "UsageTests.reset"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        UsageChoice(defaults: defaults).set(true)
        UsageChoice.resetIfAsked(defaults, arguments: ["TVScores"])
        #expect(UsageChoice(defaults: defaults).shares, "a viewer's launch keeps it")
        UsageChoice.resetIfAsked(defaults, arguments: ["TVScores", "-TVScoresReset"])
        #expect(UsageChoice(defaults: defaults).answer == .unasked)
        #expect(UsageChoice(defaults: defaults).since == nil)
    }

    @Test("nothing leaves the simulator, even after a yes")
    @MainActor
    func simulatorNeverSends() throws {
        let name = "UsageTests.simulator"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        let choice = UsageChoice(defaults: defaults)
        choice.set(true)
        #expect(Analytics.isSimulator)
        Analytics.shared.apply(choice, from: "test")
        #expect(!Analytics.shared.isSending)
    }

    @Test("the key and the zone come from the build; one left unexpanded sends nothing")
    func projectReadsInfoPlist() {
        // A made-up key of the right shape: 32 hex digits.
        let key = String(repeating: "0f", count: 16)
        #expect(Analytics.project(info: ["TVScoresAmplitudeKey": key, "TVScoresAmplitudeZone": "US"])?.zone == "US")
        #expect(Analytics.project(info: ["TVScoresAmplitudeKey": key, "TVScoresAmplitudeZone": "EU"])?.zone == "EU")
        #expect(Analytics.project(info: ["TVScoresAmplitudeKey": "$(AMPLITUDE_KEY)", "TVScoresAmplitudeZone": "US"]) == nil)
        #expect(Analytics.project(info: ["TVScoresAmplitudeKey": key]) == nil)
        #expect(Analytics.project(info: ["TVScoresAmplitudeKey": key, "TVScoresAmplitudeZone": "Mars"]) == nil)
        #expect(Analytics.project(info: Bundle.main.infoDictionary ?? [:])?.zone == "US", "this build carries the project's")
    }

    @Test("a page viewed, then left with its seconds; a setting without an item names none")
    func eventsSayWhatTheyAre() {
        let home = UsageEvent.Page.home(.today)
        #expect(UsageEvent.pageViewed(home).name == "Page Viewed")
        #expect(UsageEvent.pageViewed(home).properties["day"] as? String == "today")
        let left = UsageEvent.pageLeft(home, seconds: 42)
        #expect(left.name == "Page Left")
        #expect(left.properties["seconds"] as? Int == 42)
        #expect(left.properties["day"] as? String == "today")
        let language = UsageEvent.settingChanged(setting: "language", item: nil, old: "system", new: "fr").properties
        #expect(language["item"] == nil)
        #expect(language["old"] as? String == "system" && language["new"] as? String == "fr")
        #expect(UsageEvent.boardShown(seconds: 2.345).properties["seconds"] as? Double == 2.3)
        #expect(UsageEvent.menuOpened.properties.isEmpty)
    }

    @Test("an app chosen under How to Watch says which, never whether it opened")
    func watchAppSaysOnlyWhich() {
        // Whether it opened would say what else is installed (Apple, 5.1.2(iv)).
        let properties = UsageEvent.watchAppTapped(app: "canalplus", name: "CANAL+", country: "FR").properties
        #expect(Set(properties.keys) == ["app", "app_name", "country"])
    }

    @Test("a game's page names its sport, competition, state and sides; a race's is a race")
    func gameAndRacePages() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        let groups = Day.allCases.flatMap { board.groups(for: $0) }
        let group = try #require(groups.first { $0.events.contains { $0.kind == .match && $0.home != nil } })
        let game = try #require(group.events.first { $0.kind == .match && $0.home != nil })
        let page = UsageEvent.Page.game(game, league: group.league)
        #expect(page.name == "game")
        #expect(page.properties["competition_id"] == group.id)
        #expect(page.properties["sport"] == game.sport)
        #expect(page.properties["status"] == game.status.state.rawValue)
        #expect(page.properties["home"] == game.home?.name)
        #expect(UsageEvent.gameOpened(page, from: "home").name == "Game Opened")
        #expect(UsageEvent.gameOpened(page, from: "home").properties["from"] as? String == "home")

        let weekend = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-race"))
        let raceGroup = try #require(Day.allCases.flatMap { weekend.groups(for: $0) }.first { $0.events.contains { $0.kind == .race } })
        let race = try #require(raceGroup.events.first { $0.kind == .race })
        let racePage = UsageEvent.Page.game(race, league: raceGroup.league)
        #expect(racePage.name == "race")
        #expect(racePage.properties["race"] == race.name)
        #expect(UsageEvent.gameOpened(racePage, from: "competition").name == "Race Opened")
    }

    @Test("the profile says the device's kind, the choices and the date of the yes")
    func profileSaysTheSetup() {
        let profile = UsageProfile(platform: "tv", edition: "store", appLanguage: "system", systemLanguage: "fr-FR",
                                   locale: "fr_FR", region: "FR", timeZone: "Europe/Paris",
                                   shown: ["Top 14", "Premier League"], hidden: ["NBA"], countries: ["FR"],
                                   hiddenApps: ["dazn"], since: Date(timeIntervalSince1970: 1_800_000_000))
        let properties = profile.properties
        #expect(properties["competitions_shown"] as? [String] == ["Top 14", "Premier League"], "in the menu's order")
        #expect(properties["competitions_followed"] as? Int == 2)
        #expect(properties["competitions_hidden"] as? [String] == ["NBA"])
        #expect(properties["sharing_since"] as? String == "2027-01-15T08:00:00Z")
        #expect(properties["time_zone"] as? String == "Europe/Paris")
        #expect(UsageProfile.platform(.tv) == "tv" && UsageProfile.platform(.pad) == "pad" && UsageProfile.platform(.phone) == "phone")
    }

    @Test("the question and the Privacy switch have all four languages")
    func usageWordsAreTranslated() throws {
        let keys = ["usage.title", "usage.message", "usage.messagePhone", "usage.share", "usage.decline",
                    "settings.privacy", "settings.usage", "settings.usageNote", "settings.usageNotePhone",
                    "settings.on", "settings.off"]
        for lang in ["en", "fr", "pt", "es"] {
            let path = try #require(Bundle.main.path(forResource: lang, ofType: "lproj"), "\(lang).lproj is bundled")
            let strings = try #require(Bundle(path: path))
            let missing = keys.filter { [$0, "MISSING"].contains(strings.localizedString(forKey: $0, value: "MISSING", table: nil)) }
            #expect(missing.isEmpty, "not in \(lang): \(missing)")
        }
    }
}

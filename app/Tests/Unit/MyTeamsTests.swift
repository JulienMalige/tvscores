import Foundation
import Testing
@testable import TVScores

/// My Teams: whom the viewer follows, and which games are theirs.
@Suite("My Teams")
@MainActor
struct MyTeamsTests {
    private static func defaults() -> UserDefaults {
        let name = "my-teams-\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    private static func game(_ id: String, home: String, away: String, homeKey: String? = nil, start: String = "2026-11-15T20:00:00Z") throws -> Event {
        let key = homeKey.map { #","key":"\#($0)""# } ?? ""
        let json = #"{"id":"\#(id)","sport":"football","kind":"match","start":"\#(start)","status":{"state":"scheduled"},"home":{"name":"\#(home)","short":"H"\#(key)},"away":{"name":"\#(away)","short":"A"}}"#
        return try ScoreboardDecoder.make().decode(Event.self, from: Data(json.utf8))
    }

    private static func group(_ league: Int, _ events: [Event]) throws -> LeagueGroup {
        let json = #"{"sport":"football","league":{"id":\#(league),"name":"L\#(league)","short":"L"},"events":[]}"#
        let empty = try ScoreboardDecoder.make().decode(LeagueGroup.self, from: Data(json.utf8))
        return LeagueGroup(sport: empty.sport, league: empty.league, events: events)
    }

    @Test("a board without keys derives the proxy's: the sport, then the name without accents or punctuation")
    func derivedKeysMatchTheProxy() {
        // The same cases as proxy/test/teams.test.js.
        #expect(TeamRef.derivedKey("football", "Paris Saint-Germain") == "football:paris-saint-germain")
        #expect(TeamRef.derivedKey("football", "Atlético Madrid") == "football:atletico-madrid")
        #expect(TeamRef.derivedKey("f1", "K. Antonelli") == "f1:k-antonelli")
        #expect(TeamRef.derivedKey("rugby", "  ") == nil)
        #expect(TeamRef.derivedKey("football", "Bodø/Glimt") == "football:bod-glimt", "ø is not an accented o for the proxy either")
        #expect(TeamRef.derivedKey("football", "Borussia Mönchengladbach") == "football:borussia-monchengladbach")
    }

    @Test("a launch that resets or sets the favourites leaves iCloud alone")
    func launchArgumentsKeepICloudOut() {
        #expect(Favourites.usesCloud([]))
        #expect(!Favourites.usesCloud(["-TVScoresReset"]))
        #expect(!Favourites.usesCloud(["-TVScoresFollow", "football:lens"]))
    }

    @Test("a starred side is kept, and comes back on the next launch")
    func followingIsKept() {
        let defaults = Self.defaults()
        let favourites = Favourites(defaults: defaults, cloud: nil)
        favourites.toggle("football:paris-saint-germain", name: "Paris Saint-Germain")
        #expect(favourites.isFollowed("football:paris-saint-germain"))
        #expect(Favourites(defaults: defaults, cloud: nil).followed == ["football:paris-saint-germain": "Paris Saint-Germain"])
        favourites.toggle("football:paris-saint-germain", name: "Paris Saint-Germain")
        #expect(favourites.isEmpty)
    }

    @Test("the followed games of a day, from every competition, in kickoff order and each once")
    func gamesOfTheFollowed() throws {
        let favourites = Favourites(defaults: Self.defaults(), cloud: nil)
        favourites.toggle("football:paris-saint-germain", name: "Paris Saint-Germain")
        favourites.toggle("football:lens", name: "Lens")
        let late = try Self.game("1", home: "Paris Saint-Germain", away: "Bayern Munich", start: "2026-11-15T21:00:00Z")
        let early = try Self.game("2", home: "Brest", away: "Lens", start: "2026-11-15T15:00:00Z")
        let other = try Self.game("3", home: "Arsenal", away: "Chelsea")
        let keyed = try Self.game("4", home: "PSG (the feed's name)", away: "Nice", homeKey: "football:paris-saint-germain", start: "2026-11-16T10:00:00Z")
        let games = favourites.games(in: [try Self.group(4480, [late, other]), try Self.group(4334, [early, keyed, late])])
        #expect(games.map(\.event.id) == ["2", "1", "4"], "kickoff order; the proxy's key wins over the name")
        #expect(games.first?.group.league.id.raw == "4334", "each under its own competition")
    }

    @Test("Home lists a followed game once: not again under its competition, which goes when emptied")
    func followedGamesAreNotRepeated() throws {
        let psg = try Self.game("1", home: "Paris Saint-Germain", away: "Lens")
        let other = try Self.game("2", home: "Brest", away: "Nice")
        let groups = [try Self.group(4334, [psg, other]), try Self.group(4480, [psg])].without(["1"])
        #expect(groups.map { $0.events.map(\.id) } == [["2"]], "Ligue 1 keeps Brest–Nice; the Champions League, PSG's only, goes")
    }

    @Test("a driver followed makes every race of the series the viewer's")
    func racesOfAFollowedDriver() throws {
        let favourites = Favourites(defaults: Self.defaults(), cloud: nil)
        let race = try ScoreboardDecoder.make().decode(Event.self, from: Data(#"{"id":"r","sport":"f1","kind":"race","start":"2026-11-22T04:00:00Z","status":{"state":"scheduled"}}"#.utf8))
        #expect(!favourites.follows(race))
        favourites.toggle("f1:k-antonelli", name: "Kimi Antonelli")
        #expect(favourites.follows(race))
    }

    @Test("CI's launch can reset and then star some, without a name to hand")
    func launchArguments() {
        let defaults = Self.defaults()
        defaults.set(["football:lens": "Lens"], forKey: Favourites.storeKey)
        Favourites.prepareIfAsked(defaults, arguments: ["-TVScoresReset", "-TVScoresFollow", "rugby:stade-toulousain,football:brest"])
        let favourites = Favourites(defaults: defaults, cloud: nil)
        #expect(Set(favourites.followed.keys) == ["rugby:stade-toulousain", "football:brest"])
        #expect(favourites.followed["rugby:stade-toulousain"] == "Stade Toulousain")
    }

    @Test("/v1/teams decodes, the bundled sample included")
    func teamsListDecodes() throws {
        let url = try #require(Bundle.main.url(forResource: "sample-teams", withExtension: "json"))
        let list = try JSONDecoder().decode(TeamsList.self, from: Data(contentsOf: url))
        let ligue1 = try #require(list.teams["football:4334"])
        #expect(ligue1.contains { $0.key == "football:paris-saint-germain" })
        #expect(ChooseTeamsScreen.fold("Atlético") == "atletico")
    }
}

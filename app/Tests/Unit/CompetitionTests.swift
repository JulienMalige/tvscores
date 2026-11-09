import Foundation
import Testing
@testable import TVScores

/// The competitions: what the menu lists and the families it files them in,
/// what a page of one holds, and the sports the board is asked for.
///
/// Judged against the bundled sample, as the model's tests are.
@Suite("Model/Competitions")
struct CompetitionTests {
    private static func sample(_ name: String) throws -> Data {
        let url = try #require(Bundle.main.url(forResource: name, withExtension: "json"))
        return try Data(contentsOf: url)
    }

    @Test("every competition the menu lists has what a sidebar row needs")
    func leaguesAreComplete() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        for league in board.leagues {
            #expect(!league.menu.isEmpty, "\(league.name) has a menu name")
            // A badge we ship gives both; a feed's badge a logo alone, which
            // the menu shows in its square; a system symbol stands in for a
            // mark not worth showing (the friendlies' globe).
            #expect(league.icon != nil || league.logo != nil || league.symbol != nil, "\(league.name) has a mark for the sidebar")
            #expect(league.logo != nil || league.symbol != nil, "\(league.name) has a mark for its heading")
        }
        let ids = board.leagues.map(\.id.raw)
        #expect(Set(ids).count == ids.count, "no competition is listed twice")
    }

    @Test("a competition's page shows its own games and nothing else")
    func leaguePagesFilterTheirOwnGames() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        let groups = Day.allCases.flatMap { board.groups(for: $0) }
        for league in board.leagues {
            let mine = groups.filter { LeagueRef(league).matches($0) }
            #expect(mine.allSatisfy { $0.sport == league.sport && $0.league.id == league.id }, "\(league.name)")
            // `playing` is what the menu greys a row on; it must agree with the buckets.
            #expect(league.playing == !mine.isEmpty, "\(league.name) is marked playing exactly when it has games this week")
        }
        for group in groups {
            let ref = LeagueRef(group: group)
            #expect(groups.filter { ref.matches($0) }.allSatisfy { $0.id == group.id }, "\(group.id) matches only itself")
        }
    }

    @Test("a competition with nothing this week says when it is next on")
    func idleLeaguesSayWhenTheyAreBack() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        let nba = try #require(board.leagues.first { $0.sport == "nba" })
        #expect(!nba.playing)
        let next = try #require(nba.next)
        #expect(next.start > board.generatedAt)
        #expect(next.season?.isEmpty == false)
        for league in board.leagues where league.playing {
            #expect(league.next == nil, "\(league.name) is on this week and has no next to speak of")
        }
    }

    @Test("the board is asked for every sport the menu has a place for, rugby with them")
    func boardNamesItsSports() throws {
        let base = try #require(URL(string: "https://tvscores.example"))
        let url = ScoreboardStore.boardURL(base, zone: try #require(TimeZone(identifier: "America/Sao_Paulo")))
        let items = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
        #expect(url.path() == "/v1/scoreboard")
        #expect(items.first { $0.name == "tz" }?.value == "America/Sao_Paulo")
        let sports = try #require(items.first { $0.name == "sports" }?.value).split(separator: ",").map(String.init)
        #expect(sports == SportSection.all.flatMap(\.sports))
        #expect(sports.contains("rugby"), "without it the proxy holds rugby back, as from builds up to 1.0")
    }

    @Test("rugby's competitions have a family of their own, its national sides' too")
    @MainActor
    func rugbyHasItsOwnSection() throws {
        let json = #"""
        [{"sport":"rugby","id":4430,"name":"Top 14","menu":"Top 14","short":"T14","hasStandings":false,"playing":true},
         {"sport":"rugby","id":4714,"name":"Six Nations Championship","menu":"Six Nations","short":"6N","hasStandings":false,"playing":false},
         {"sport":"football","id":4562,"name":"International Friendlies","menu":"Friendlies","short":"INT","section":"international","hasStandings":false,"playing":true}]
        """#
        let leagues = try ScoreboardDecoder.make().decode([LeagueSummary].self, from: Data(json.utf8))
        let families = SportSection.grouped(leagues, all: true)
        let rugby = try #require(families.first { $0.section.id == "rugby" })
        #expect(rugby.leagues.map(\.id.raw).sorted() == ["4430", "4714"])
        #expect(families.first { $0.section.id == "international" }?.leagues.map(\.sport) == ["football"])
    }

    @Test("the flows' reset forgets the competitions chosen, and only when asked")
    @MainActor
    func resetForgetsTheChoices() throws {
        let name = "CompetitionTests.reset"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        defaults.set(["football:4351"], forKey: "hiddenLeagues")
        defaults.set(["football:4331", "football:4351"], forKey: "leagueOrder")
        LeagueChoice.resetIfAsked(defaults, arguments: ["TVScores"])
        #expect(defaults.stringArray(forKey: "hiddenLeagues") == ["football:4351"], "a viewer's launch keeps them")
        LeagueChoice.resetIfAsked(defaults, arguments: ["TVScores", "-TVScoresReset"])
        #expect(defaults.stringArray(forKey: "hiddenLeagues") == nil)
        #expect(defaults.stringArray(forKey: "leagueOrder") == nil)
        #expect(LeagueChoice(defaults: defaults).isShown("football:4351"), "and the competition hidden before is shown")
    }
}

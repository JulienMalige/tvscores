import Foundation
import Testing
@testable import TVScores

/// The model: the proxy's JSON becoming the types every screen reads.
///
/// Judged against the same bundled sample the CI screenshots use, so a field
/// the proxy adds or drops is caught here before it is caught on a television.
@Suite("Model")
struct ModelTests {
    private static func sample(_ name: String) throws -> Data {
        let url = try #require(Bundle.main.url(forResource: name, withExtension: "json"))
        return try Data(contentsOf: url)
    }

    @Test("the bundled scoreboard decodes whole")
    func scoreboardDecodes() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        #expect(!board.leagues.isEmpty)
        #expect(board.groups(for: .today).count + board.groups(for: .upcoming).count > 0)
        #expect(board.tz == "America/Sao_Paulo", "captured in Julien's zone, as AGENTS.md says it must be")
    }

    @Test("every competition the menu lists has what a sidebar row needs")
    func leaguesAreComplete() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        for league in board.leagues {
            #expect(!league.menu.isEmpty, "\(league.name) has a menu name")
            #expect(league.icon != nil, "\(league.name) has a square icon for the sidebar")
            #expect(league.logo != nil, "\(league.name) has a mark for its heading")
        }
        let ids = board.leagues.map(\.id.raw)
        #expect(Set(ids).count == ids.count, "no competition is listed twice")
    }

    @Test("a state the proxy has not taught us reads as other, never as a crash")
    func unknownStateIsOther() throws {
        let json = #"{"state":"halftime-of-the-future","clock":null,"detail":null,"note":null}"#
        let status = try JSONDecoder().decode(Status.self, from: Data(json.utf8))
        #expect(status.state == .other)
    }

    @Test("a league id is a number from one provider and a word from another")
    func flexibleIds() throws {
        #expect(try JSONDecoder().decode(FlexibleID.self, from: Data("4328".utf8)).raw == "4328")
        #expect(try JSONDecoder().decode(FlexibleID.self, from: Data(#""standard""#.utf8)).raw == "standard")
    }

    @Test("the standings bundle decodes, and a table of marques carries its badges")
    func standingsDecode() throws {
        let bundle = try ScoreboardDecoder.make().decode(StandingsBundle.self, from: Self.sample("sample-standings"))
        let f1 = try #require(bundle.standings["f1:f1"])
        let constructors = try #require(f1.tables.first { $0.id == "constructors" })
        #expect(constructors.rows.allSatisfy { $0.logo != nil }, "every constructor has its marque")
        #expect(constructors.rows.allSatisfy { $0.sub?.contains(",") == true }, "and its drivers under it")
        let drivers = try #require(f1.tables.first { $0.id == "drivers" })
        #expect(drivers.rows.first?.pos == 1)
    }

    @Test("kickoff times arrive as instants, not as wall-clock guesses")
    func startsAreInstants() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-scoreboard"))
        let events = Day.allCases.flatMap { board.groups(for: $0) }.flatMap(\.events)
        #expect(!events.isEmpty)
        // A start decoded in the wrong zone lands hours from every other start
        // of the same fixture list; none is more than nine days from generation.
        for e in events {
            #expect(abs(e.start.timeIntervalSince(board.generatedAt)) < 9 * 86400, "\(e.id)")
        }
    }
}

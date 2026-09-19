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
        // Alpine and Williams keep their initials by design: their lockups
        // carry only a sponsor mark. The podium three always have a marque.
        #expect(constructors.rows.prefix(3).allSatisfy { $0.logo != nil }, "the leading constructors have their marques")
        #expect(constructors.rows.allSatisfy { $0.sub?.contains(",") == true }, "and every one has its drivers under it")
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

    @Test("one stale sport makes the whole board say so")
    func staleSurfaces() throws {
        var json = try #require(JSONSerialization.jsonObject(with: Self.sample("sample-scoreboard")) as? [String: Any])
        var stale = try #require(json["stale"] as? [String: Bool])
        #expect(!stale.values.contains(true), "the sample was captured with every source answering")
        stale["nfl"] = true
        json["stale"] = stale
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(board.isStale)
    }

    @Test("a row is known by its nickname when it has one, and a non-finisher by its outcome")
    func rowIdentities() throws {
        let lions = try JSONDecoder().decode(TeamRef.self, from: Data(#"{"name":"Detroit Lions","short":"DET","nick":"Lions"}"#.utf8))
        #expect(lions.label == "Lions")
        let inter = try JSONDecoder().decode(TeamRef.self, from: Data(#"{"name":"Inter Milan","short":"INT"}"#.utf8))
        #expect(inter.label == "Inter Milan")
        let dnf = try JSONDecoder().decode(RaceResult.self, from: Data(#"{"driver":"Lando Norris","gap":"Collision"}"#.utf8))
        #expect(!dnf.finished)
        #expect(dnf.id == "--Lando Norris", "a retirement has no position and must not collide with one that does")
    }

    @Test("a race carries its country's flag and the weekend's timetable")
    func racesCarryFlagAndSessions() throws {
        let board = try ScoreboardDecoder.make().decode(Scoreboard.self, from: Self.sample("sample-race"))
        let races = Day.allCases.flatMap { board.groups(for: $0) }.flatMap(\.events).filter { $0.kind == .race }
        #expect(!races.isEmpty)
        for race in races {
            #expect(race.flag?.isEmpty == false, "\(race.name ?? race.id) has a flag")
            let sessions = try #require(race.sessions)
            #expect(sessions.contains { $0.kind == "race" }, "\(race.name ?? race.id) lists the race itself")
            #expect(sessions == sessions.sorted { $0.start < $1.start }, "in the order of the weekend")
        }
    }

    @Test("a table read as numbers has a cell per column, and its cuts fall inside it")
    func tablesLineUp() throws {
        let bundle = try ScoreboardDecoder.make().decode(StandingsBundle.self, from: Self.sample("sample-standings"))
        for (key, standings) in bundle.standings {
            // A team sport's table is read as columns; a table of people —
            // drivers, riders, players — is a list with a number beside each.
            let people = key.hasPrefix("f1:") || key.hasPrefix("motogp:") || key.hasPrefix("tennis:")
            for table in standings.tables {
                #expect((table.columns == nil) == people, "\(key) \(table.id)")
                guard let columns = table.columns else { continue }
                for row in table.rows {
                    #expect(row.cells?.count == columns.count, "\(key) \(row.name)")
                }
                for line in table.lines ?? [] {
                    #expect(line.after >= 1 && line.after < table.rows.count, "\(key): a cut after row \(line.after) is inside the table")
                }
                for zone in table.legend ?? [] {
                    #expect(zone.from <= zone.to && zone.to <= table.rows.count, "\(key): \(zone.key)")
                }
            }
        }
        let nfl = try #require(bundle.standings["nfl:4391"])
        #expect(nfl.tables.map(\.id) == ["AFC", "NFC"])
        #expect(nfl.tables[0].rows.allSatisfy { $0.section != nil }, "a conference is read division by division")
        #expect(nfl.tables[0].lines == nil, "and has no cut lines through its divisions")
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
}

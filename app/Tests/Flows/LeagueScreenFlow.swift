import XCTest

/// A competition's page: its own games, and the table under them.
final class LeagueScreenFlow: FlowCase {

    func testFormulaOneIsReachableWithNoRaceThisWeek() {
        // The whole reason the Competitions tab exists: F1 races every other
        // weekend, and its page — and championship — used to vanish in between.
        let app = Flow.launch(league: "f1")
        app.buttons["table.drivers"].appears(within: 10)
        app.buttons["table.constructors"].appears()
        app.buttons["standing.1"].appears()
    }

    func testDriversAndConstructorsAreTwoTablesWithLineUps() {
        let app = Flow.launch(league: "f1", extra: ["-TVScoresTable", "constructors"])
        app.buttons["standing.1"].appears(within: 10)
        // Constructors carry their drivers under the marque.
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS ','")).firstMatch.exists,
                      "a constructor row names its drivers, comma separated")
    }

    func testDriversTableShowsTheTeamUnderEachDriver() {
        let app = Flow.launch(league: "f1", extra: ["-TVScoresTable", "drivers"])
        app.buttons["standing.1"].appears(within: 10)
        XCTAssertTrue(app.staticTexts["Mercedes"].firstMatch.exists, "a driver row shows the team as its subtitle")
    }

    func testMotoGPTeamsHaveTheirMarquesAndRiders() {
        let app = Flow.launch(league: "motogp", extra: ["-TVScoresTable", "teams"])
        app.buttons["standing.1"].appears(within: 10)
        XCTAssertTrue(app.staticTexts["Aprilia Racing"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS ','")).firstMatch.exists,
                      "riders under the marque, the same as Formula 1")
    }

    func testADomesticLeagueShowsItsTable() {
        // The first football league by name: Brasileirão in the sample. Its
        // table sits under its games, so the remote has to walk down to it.
        let app = Flow.launch(league: "football")
        app.staticTexts["Standings"].appears(within: 10)
        let leader = app.buttons["standing.1"]
        XCTAssertTrue(Flow.walk(.down, until: leader, limit: 40), "focus walks down to the top of the table")
        XCTAssertTrue(app.buttons["standing.20"].exists, "and the table has twenty rows")
    }
}

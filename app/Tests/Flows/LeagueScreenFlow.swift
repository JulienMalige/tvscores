import XCTest

/// A competition's page: its own games, and the table under them.
final class LeagueScreenFlow: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    func testFormulaOneIsReachableWithNoRaceThisWeek() {
        // The whole reason the sidebar exists: F1 races every other weekend,
        // and its page — and championship — used to vanish in between.
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
        // Switch to drivers by remote and confirm the table changed.
        XCTAssertTrue(Flow.walk(.up, until: app.buttons["table.constructors"]))
        Flow.remote.press(.left)
        Flow.remote.press(.select)
        app.buttons["standing.1"].appears()
        XCTAssertTrue(app.staticTexts["Mercedes"].exists, "a driver row shows the team as its subtitle")
    }

    func testMotoGPTeamsHaveTheirMarquesAndRiders() {
        let app = Flow.launch(league: "motogp", extra: ["-TVScoresTable", "teams"])
        app.buttons["standing.1"].appears(within: 10)
        XCTAssertTrue(app.staticTexts["Aprilia Racing"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS ','")).firstMatch.exists,
                      "riders under the marque, the same as Formula 1")
    }

    func testADomesticLeagueShowsItsTable() {
        let app = Flow.launch(league: "football")   // the first football league: Brasileirão in the sample
        app.buttons["standing.1"].appears(within: 10)
        app.buttons["standing.20"].appears()
    }
}

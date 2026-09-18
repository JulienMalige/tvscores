import XCTest

/// The list of competitions: every one we follow, on this week or not, each
/// opening its own page.
final class CompetitionsScreenFlow: FlowCase {

    func testEveryCompetitionIsListedPlayingOrNot() {
        let app = Flow.launch(tab: "competitions")
        // Formula 1 has no race this week in the sample and is listed anyway
        // — the whole reason this page exists.
        app.buttons["competition.f1.f1"].appears()
        XCTAssertTrue(app.buttons["competition.football.4481"].exists, "the Europa League is in the list")
        XCTAssertTrue(app.staticTexts["No games this week"].firstMatch.exists, "a competition with nothing on says so")
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'competition.'")).count
        XCTAssertGreaterThanOrEqual(rows, 10, "the list holds every competition, not just this week's")
    }

    func testOpeningACompetitionAndComingBack() {
        let app = Flow.launch(tab: "competitions")
        let f1 = app.buttons["competition.f1.f1"]
        f1.appears()
        XCTAssertTrue(Flow.walk(.down, until: f1, limit: 20), "focus walks down to Formula 1")
        Flow.remote.press(.select)
        app.buttons["table.drivers"].appears(within: 10)
        Flow.remote.press(.menu)
        XCTAssertTrue(app.staticTexts["page.competitions"].waitForExistence(timeout: 8), "back returns to the list")
        XCTAssertFalse(app.buttons["table.drivers"].exists, "and the Formula 1 page is gone")
    }
}

import XCTest

/// The list of competitions: every one we follow, on this week or not, each
/// opening its own page.
final class CompetitionsScreenFlow: FlowCase {

    /// The list is lazy: a row exists once the remote has scrolled to it.
    private func walkToFormulaOne(_ app: XCUIApplication) -> XCUIElement {
        app.buttons["competition.football.4351"].appears()
        let f1 = app.buttons["competition.f1.f1"]
        XCTAssertTrue(Flow.walk(.down, until: f1, limit: 20), "focus walks down to Formula 1")
        return f1
    }

    func testEveryCompetitionIsListedPlayingOrNot() {
        let app = Flow.launch(tab: "competitions")
        // Formula 1 has no race this week in the sample and is listed anyway
        // — the whole reason this page exists — and says so.
        _ = walkToFormulaOne(app)
        XCTAssertTrue(app.buttons["competition.football.4481"].exists, "the Europa League is in the list")
        XCTAssertTrue(app.staticTexts["No games this week"].firstMatch.exists, "a competition with nothing on says so")
    }

    func testOpeningACompetitionAndComingBack() {
        let app = Flow.launch(tab: "competitions")
        _ = walkToFormulaOne(app)
        Flow.remote.press(.select)
        app.buttons["table.drivers"].appears(within: 10)
        Flow.remote.press(.menu)
        XCTAssertTrue(app.staticTexts["page.competitions"].waitForExistence(timeout: 8), "back returns to the list")
        XCTAssertFalse(app.buttons["table.drivers"].exists, "and the Formula 1 page is gone")
    }
}

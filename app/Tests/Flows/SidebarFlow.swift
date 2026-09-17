import XCTest

/// The menu: it opens, it lists everything, it takes you somewhere, and it
/// stays open while the scores behind it change.
final class SidebarFlow: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    /// Focus left from the page opens the sidebar; the Home tab is its first entry.
    private func openSidebar(_ app: XCUIApplication) -> XCUIElement {
        app.buttons["day.today"].appears()
        let home = app.buttons["Home"].firstMatch
        XCTAssertTrue(Flow.walk(.left, until: home, limit: 6), "pressing left opens the menu on Home")
        return home
    }

    func testMenuOpensAndListsEveryCompetition() {
        let app = Flow.launch()
        _ = openSidebar(app)
        for name in ["Premier League", "Champions League", "Formula 1", "MotoGP", "ATP Tour", "NFL"] {
            XCTAssertTrue(app.buttons[name].firstMatch.exists, "\(name) is in the menu")
        }
    }

    func testSelectingACompetitionOpensItsPage() {
        let app = Flow.launch()
        _ = openSidebar(app)
        let f1 = app.buttons["Formula 1"].firstMatch
        XCTAssertTrue(Flow.walk(.down, until: f1, limit: 20))
        Flow.remote.press(.select)
        app.buttons["table.drivers"].appears(within: 10)
    }

    func testMenuStaysOpenWhileTheBoardRefreshes() {
        // Both halves of "it opens and closes": focus being taken back by the
        // page, and the menu being rebuilt under a refresh. The demo board
        // reloads every 30 s while a live match is in it; 40 s covers one.
        let app = Flow.launch()
        let home = openSidebar(app)
        XCTAssertTrue(home.hasFocus)
        sleep(40)
        XCTAssertTrue(app.buttons["Formula 1"].firstMatch.exists, "the menu is still open after a refresh")
        XCTAssertTrue(app.buttons["Home"].firstMatch.hasFocus, "and focus is still in it")
    }
}

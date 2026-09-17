import XCTest

/// The menu: it opens, it lists everything, it takes you somewhere, and it
/// stays open while the scores behind it change.
final class SidebarFlow: FlowCase {

    /// Focus left from the page opens the sidebar. Collapsed, it shows only the
    /// current entry; open, it lists every competition — so "Formula 1 is on
    /// screen" is what proves it opened.
    private func openSidebar(_ app: XCUIApplication) {
        app.buttons["day.today"].appears()
        let f1 = app.buttons["Formula 1"].firstMatch
        for _ in 0..<6 where !f1.exists {
            Flow.remote.press(.left)
            usleep(400_000)
        }
        XCTAssertTrue(f1.waitForExistence(timeout: 4), "pressing left opens the menu and lists the competitions")
    }

    func testMenuOpensAndListsEveryCompetition() {
        let app = Flow.launch()
        openSidebar(app)
        for name in ["Premier League", "Champions League", "Formula 1", "MotoGP", "ATP Tour", "NFL"] {
            XCTAssertTrue(app.buttons[name].firstMatch.exists, "\(name) is in the menu")
        }
    }

    func testSelectingACompetitionOpensItsPage() {
        let app = Flow.launch()
        openSidebar(app)
        let f1 = app.buttons["Formula 1"].firstMatch
        XCTAssertTrue(Flow.walk(.down, until: f1, limit: 20), "focus walks down the menu to Formula 1")
        Flow.remote.press(.select)
        app.buttons["table.drivers"].appears(within: 10)
    }

    func testMenuStaysOpenWhileTheBoardRefreshes() {
        // Both halves of "it opens and closes": focus being taken back by the
        // page, and the menu being rebuilt under a refresh. The demo board
        // reloads every 30 s while a live match is in it; 40 s covers one.
        let app = Flow.launch()
        openSidebar(app)
        sleep(40)
        XCTAssertTrue(app.buttons["Formula 1"].firstMatch.exists, "the menu is still open after a refresh")
    }
}

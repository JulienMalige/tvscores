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
        // The top of the list is on screen as soon as the menu opens…
        for name in ["Brasileirão", "Bundesliga", "Champions League", "Formula 1"] {
            XCTAssertTrue(app.buttons[name].firstMatch.exists, "\(name) is in the menu")
        }
        // …and the bottom is reached by walking, the way a person would. Fifteen
        // competitions do not all fit; a row below the fold does not exist yet.
        let nfl = app.buttons["NFL"].firstMatch
        for _ in 0..<20 where !nfl.exists {
            Flow.remote.press(.down)
            usleep(150_000)
        }
        XCTAssertTrue(nfl.exists, "NFL is in the menu, at the bottom")
    }

    func testSelectingACompetitionOpensItsPage() {
        let app = Flow.launch()
        openSidebar(app)
        // Walk down to Formula 1 and select it. Whether focus is reported on
        // a system-drawn row is not something to lean on; the page opening is
        // the proof, and it fails plainly if the selection landed elsewhere.
        _ = Flow.walk(.down, until: app.buttons["Formula 1"].firstMatch, limit: 20)
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

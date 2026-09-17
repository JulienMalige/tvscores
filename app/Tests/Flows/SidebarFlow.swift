import XCTest

/// The menu: it opens, it lists everything, it takes you somewhere, and it
/// stays open while the scores behind it change.
final class SidebarFlow: FlowCase {

    /// A row of the menu, as the tree reports it. Collapsed, the sidebar still
    /// lists every row — disabled, at 0×0 — so `exists` says nothing about
    /// whether the menu is open. A row that is open has a frame.
    private func row(_ app: XCUIApplication, _ name: String) -> XCUIElement { app.buttons[name].firstMatch }
    private func isOpen(_ row: XCUIElement) -> Bool { row.exists && row.frame.width > 0 && row.isEnabled }

    /// Focus left from the page opens the sidebar.
    private func openSidebar(_ app: XCUIApplication) {
        let f1 = row(app, "Formula 1")
        for _ in 0..<6 where !isOpen(f1) {
            Flow.remote.press(.left)
            usleep(500_000)
        }
        XCTAssertTrue(isOpen(f1), "pressing left opens the menu: its rows have frames")
    }

    func testMenuOpensAndListsEveryCompetition() {
        let app = Flow.launch()
        openSidebar(app)
        // The top of the list is drawn as soon as the menu opens…
        for name in ["Brasileirão", "Bundesliga", "Champions League", "Formula 1"] {
            XCTAssertTrue(isOpen(row(app, name)), "\(name) is in the menu, drawn")
        }
        // …and the bottom is reached by walking, the way a person would.
        let nfl = row(app, "NFL")
        for _ in 0..<20 where !(isOpen(nfl) && nfl.frame.maxY < 1080) {
            Flow.remote.press(.down)
            usleep(150_000)
        }
        XCTAssertTrue(isOpen(nfl) && nfl.frame.maxY < 1080, "NFL is in the menu, at the bottom, and walking reaches it")
    }

    func testSelectingACompetitionOpensItsPage() {
        let app = Flow.launch()
        openSidebar(app)
        // A system-drawn row does not report focus, so the walk is counted:
        // the menu opens on the current entry, Home, and Formula 1 is as many
        // presses down as there are drawn rows between them.
        let rows = app.buttons.allElementsBoundByIndex.filter { $0.frame.width > 0 && $0.frame.minX < 40 }.map(\.label)
        guard let home = rows.firstIndex(of: "Home"), let f1 = rows.firstIndex(of: "Formula 1"), f1 > home else {
            return XCTFail("the open menu lists Home above Formula 1; it lists \(rows)")
        }
        for _ in 0..<(f1 - home) {
            Flow.remote.press(.down)
            usleep(200_000)
        }
        Flow.remote.press(.select)
        // The page opening is the proof; a selection that landed elsewhere fails here.
        app.buttons["table.drivers"].appears(within: 10)
    }

    func testMenuStaysOpenWhileTheBoardRefreshes() {
        // Both halves of "it opens and closes": focus being taken back by the
        // page, and the menu being rebuilt under a refresh. The demo board
        // reloads every 30 s while a live match is in it; 40 s covers one.
        let app = Flow.launch()
        openSidebar(app)
        sleep(40)
        XCTAssertTrue(isOpen(row(app, "Formula 1")), "the menu is still open after a refresh: its rows still have frames")
    }
}

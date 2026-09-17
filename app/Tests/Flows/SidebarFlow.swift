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
    ///
    /// Asked about sparingly. Every read of a frame is an accessibility
    /// snapshot of the whole hierarchy, and the flow that read one every
    /// second watched the menu shut in its hands while the flow that read
    /// one every five seconds saw it stay open through a refresh, four runs
    /// out of four. The engine is not to be interrogated at 1 Hz.
    private func openSidebar(_ app: XCUIApplication) {
        let f1 = row(app, "Formula 1")
        for _ in 0..<3 {
            Flow.remote.press(.left)
            sleep(2)
            if isOpen(f1) { return }
        }
        XCTAssertTrue(isOpen(f1), "pressing left opens the menu: its rows have frames")
    }

    func testMenuOpensAndListsEveryCompetition() {
        let app = Flow.launch()
        // The count to the last row is taken from the collapsed menu, which
        // lists every row; the open one is drawn lazily and its last rows are
        // not in the tree until reached.
        let order = app.buttons.allElementsBoundByIndex.map(\.label)
        guard let home = order.firstIndex(of: "Home"), let nfl = order.firstIndex(of: "NFL"), nfl > home else {
            return XCTFail("the menu lists Home above NFL; it lists \(order)")
        }
        openSidebar(app)
        // The top of the list is drawn as soon as the menu opens…
        for name in ["Brasileirão", "Bundesliga", "Champions League", "Formula 1"] {
            XCTAssertTrue(isOpen(row(app, name)), "\(name) is in the menu, drawn")
        }
        // …and the bottom is reached by walking, the way a person would: NFL
        // is the last row, so walking to the end of the list must find it drawn
        // on screen. The walk is counted, not watched, for the reason above.
        for _ in 0..<(nfl - home) {
            Flow.remote.press(.down)
            usleep(200_000)
        }
        sleep(1)
        let last = row(app, "NFL")
        XCTAssertTrue(isOpen(last) && last.frame.maxY <= 1080, "NFL is in the menu, at the bottom, and walking reaches it")
    }

    func testSelectingACompetitionOpensItsPage() {
        let app = Flow.launch()
        // A system-drawn row does not report focus, so the walk is counted.
        // The collapsed menu already lists every row in order, so the count is
        // taken before opening — cheaply, and before anything can shut it —
        // then the menu is opened and walked without pause.
        let order = app.buttons.allElementsBoundByIndex.map(\.label)
        guard let home = order.firstIndex(of: "Home"), let f1 = order.firstIndex(of: "Formula 1"), f1 > home else {
            return XCTFail("the menu lists Home above Formula 1; it lists \(order)")
        }
        openSidebar(app)
        for _ in 0..<(f1 - home) {
            Flow.remote.press(.down)
            usleep(120_000)
        }
        Flow.remote.press(.select)
        // The page opening is the proof; a selection that landed elsewhere fails here.
        app.buttons["table.drivers"].appears(within: 10)
    }

    /// Where focus is, for the log: the one fact that separates "the page
    /// took focus back" from "the menu closed on its own".
    private func reportFocus(_ app: XCUIApplication, _ when: String) {
        let focused = app.descendants(matching: .any).matching(NSPredicate(format: "hasFocus == 1")).allElementsBoundByIndex
        let names = focused.prefix(3).map { "\($0.elementType.rawValue):\($0.identifier.isEmpty ? $0.label : $0.identifier)" }
        print("TREE| focus \(when): \(names.isEmpty ? "nowhere" : names.joined(separator: ", "))")
    }

    func testMenuStaysOpenWhileTheBoardRefreshes() {
        // Both halves of "it opens and closes": focus being taken back by the
        // page, and the menu being rebuilt under a refresh. The demo board
        // reloads every 30 s while a live match is in it; 40 s covers one.
        let app = Flow.launch()
        openSidebar(app)
        // No look at focus here: finding the focused element evaluates every
        // element in the hierarchy, the heaviest interrogation there is, and
        // the menu shut within five seconds of it every time. Focus is asked
        // about only after the menu has shut, when there is nothing to disturb.
        // Watched every five seconds — sparingly, see above — so a failure
        // still says roughly when it shut: early is focus being taken; past
        // thirty seconds is the refresh.
        let f1 = row(app, "Formula 1")
        var shutAt: Int?
        for check in 1...8 {
            sleep(5)
            if !isOpen(f1) { shutAt = check * 5; break }
        }
        if let shutAt {
            print("TREE| the menu shut after \(shutAt)s")
            reportFocus(app, "after it shut")
        }
        XCTAssertNil(shutAt, "the menu is still open after a refresh; it shut after \(shutAt ?? 0)s")
    }

    func testMenuStaysOpenWhileInUse() {
        // A person in the menu is moving through it. Whatever closes an idle
        // menu, one being used must survive a refresh: this walks up and down
        // every few seconds across the 30 s reload and expects it drawn
        // throughout.
        let app = Flow.launch()
        openSidebar(app)
        let f1 = row(app, "Formula 1")
        for step in 0..<8 {
            Flow.remote.press(step % 2 == 0 ? .down : .up)
            sleep(5)
            XCTAssertTrue(isOpen(f1), "the menu is still drawn \((step + 1) * 5)s in, while in use")
        }
    }
}

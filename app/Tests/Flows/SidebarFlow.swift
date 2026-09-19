import XCTest

/// The menu: it opens and takes you to the competition you pick. Not
/// something the simulator can say — see NavigationFlow — so this is a probe
/// for the next time the menu is suspected, run by hand.
final class SidebarFlow: FlowCase {

    func testSelectingACompetitionOpensItsPage() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["TVSCORES_MENU_PROBE"] == "1",
                          "the simulator cannot drive the menu; set TVSCORES_MENU_PROBE=1 to probe by hand")
        let app = Flow.launch()
        // A system-drawn row does not report focus, so the walk is counted.
        // The collapsed menu already lists every row in order, so the count is
        // taken before opening — cheaply, and before anything can shut it —
        // then the menu is opened and walked without pause.
        let order = app.buttons.allElementsBoundByIndex.map(\.label)
        guard let home = order.firstIndex(of: "Home"), let f1 = order.firstIndex(of: "Formula 1"), f1 > home else {
            return XCTFail("the menu lists Home above Formula 1; it lists \(order)")
        }
        Flow.openMenu(app)
        for _ in 0..<(f1 - home) {
            Flow.remote.press(.down)
            usleep(120_000)
        }
        Flow.remote.press(.select)
        // The page opening is the proof; a selection that landed elsewhere fails here.
        app.buttons["Drivers"].firstMatch.appears(within: 10)
    }
}

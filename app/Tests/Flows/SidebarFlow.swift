import XCTest

/// The menu: it opens and takes you to the competition you pick. Whether it
/// stays open is not something the simulator can say — see NavigationFlow.
final class SidebarFlow: FlowCase {

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
        Flow.openMenu(app)
        for _ in 0..<(f1 - home) {
            Flow.remote.press(.down)
            usleep(120_000)
        }
        Flow.remote.press(.select)
        // The page opening is the proof; a selection that landed elsewhere fails here.
        app.buttons["table.drivers"].appears(within: 10)
    }
}

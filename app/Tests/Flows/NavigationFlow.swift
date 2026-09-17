import XCTest

/// What joins the screens: where focus lands, how the menu opens and closes,
/// and that a press takes you where it says and back again.
///
/// The flows before this one each prove a screen; this one proves the moves
/// between them, which is where "the menu opens and closes" lived.
final class NavigationFlow: FlowCase {

    // MARK: Focus

    func testFocusStartsOnTheDayBeingShown() {
        // Launched on Upcoming, the highlight starts on Upcoming. The leading
        // pill instead is the engine re-seeding from nothing — the fingerprint
        // of a menu that has just been shut from under its reader.
        let app = Flow.launch(tab: "upcoming")
        sleep(1)
        XCTAssertTrue(app.buttons["day.upcoming"].hasFocus, "focus starts on the selected pill, not the leading one")
    }

    func testPickingADayKeepsFocusOnIt() {
        // Selecting a pill swaps it for its filled twin and the list under it
        // for another day's. Focus must ride that out, not jump elsewhere.
        let app = Flow.launch(tab: "today")
        XCTAssertTrue(Flow.walk(.right, until: app.buttons["day.upcoming"]), "the remote reaches the Upcoming pill")
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertTrue(app.buttons["day.upcoming"].hasFocus, "the pill just picked keeps focus while its list is swapped in")
    }

    // MARK: The menu

    func testTheMenuOpensOnOnePressLeft() {
        let app = Flow.launch()
        Flow.remote.press(.left)
        sleep(2)
        XCTAssertTrue(Flow.menuIsOpen(app), "one press left from the pills opens the menu")
    }

    func testTheMenuOpensFromARowToo() {
        // Not only from the pills: from a match row, left has nothing to go
        // to on the page, and that is the menu's cue on tvOS.
        let app = Flow.launch()
        let first = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: first, limit: 12), "focus reaches the first match row")
        Flow.remote.press(.left)
        sleep(2)
        XCTAssertTrue(Flow.menuIsOpen(app), "left from a match row opens the menu as well")
    }

    func testClosingTheMenuPutsFocusBackOnThePage() {
        let app = Flow.launch()
        Flow.openMenu(app)
        Flow.remote.press(.right)
        sleep(1)
        XCTAssertFalse(Flow.menuIsOpen(app), "right shuts the menu")
        let pills = ["yesterday", "today", "upcoming"].map { app.buttons["day.\($0)"] }
        XCTAssertTrue(pills.contains { $0.hasFocus }, "and focus is back on the page, on a day pill")
    }

    func testTheMenuStaysOpenUntilDismissed() {
        // The bug as reported: the menu opened and shut on its own. The demo
        // board reloads every 30 s while a live match is in it, so forty
        // seconds spans a refresh — and nothing is asked of the app in
        // between, since asking is what shut it in the earlier probes. One
        // look at the end, and only if that finds it shut, a look at focus.
        let app = Flow.launch()
        Flow.openMenu(app)
        sleep(40)
        let open = Flow.menuIsOpen(app)
        if !open { Flow.reportFocus(app, "after the menu shut on its own") }
        XCTAssertTrue(open, "the menu is still open forty seconds and one refresh later")
    }

    // MARK: Between screens

    func testHomeFromTheMenuReturnsToTheFrontPage() {
        let app = Flow.launch(league: "f1")
        app.buttons["table.drivers"].appears(within: 10)
        // The rows between Formula 1 and Home, counted from the collapsed tree
        // as the selection flow does — a system row reports no focus.
        let order = app.buttons.allElementsBoundByIndex.map(\.label)
        guard let home = order.firstIndex(of: "Home"), let f1 = order.firstIndex(of: "Formula 1"), f1 > home else {
            return XCTFail("the menu lists Home above Formula 1; it lists \(order)")
        }
        Flow.focusThePage()
        Flow.openMenu(app)
        for _ in 0..<(f1 - home) {
            Flow.remote.press(.up)
            usleep(120_000)
        }
        Flow.remote.press(.select)
        app.buttons["league.football.4501"].appears(within: 10)
        XCTAssertFalse(app.buttons["table.drivers"].exists, "and the Formula 1 page is gone")
    }

    func testARaceOpensFromItsRowAndBackReturnsToItsCompetition() {
        // A race opened from the Formula 1 page comes back to Formula 1, not
        // to Home: each competition's page has its own navigation.
        let app = Flow.launch(tab: "yesterday", league: "f1", extra: ["-TVScoresSample", "race"])
        app.buttons["table.drivers"].appears(within: 10)
        Flow.focusThePage()
        let race = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'race.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: race, limit: 10), "focus reaches the race row")
        Flow.remote.press(.select)
        app.staticTexts["Race Result"].appears(within: 10)
        Flow.remote.press(.menu)
        app.buttons["table.drivers"].appears(within: 8)
        XCTAssertFalse(app.staticTexts["Race Result"].exists, "back leaves the race, on the competition it was opened from")
    }
}

import XCTest

/// What joins the screens: where focus lands, how the menu opens and closes,
/// and that a press takes you where it says and back again.
///
/// The flows before this one each prove a screen; this one proves the moves
/// between them, which is where "the menu opens and closes" lived.
///
/// What the simulator can and cannot say about the menu, settled on
/// 2026-09-17 over eight CI runs: driven by `XCUIRemote`, the system sidebar
/// never stays open. It expands on a press left and is shut again within a
/// second — with every piece of ours switched off, and for a bare three-tab
/// `TabView` with nothing of ours in it at all. Focus at launch sits on the
/// sidebar's hidden cell, and one press left moves it to the page's leading
/// pill. So a flow that needs the menu open for longer than the walk it makes
/// straight after opening it is a probe, run by hand with
/// TVSCORES_MENU_PROBE=1, and gates nothing; the television is the judge of
/// whether the menu stays open. The moves that act on the menu at once —
/// select, close, back — do hold, and gate.
final class NavigationFlow: FlowCase {
    private func probeOnly() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["TVSCORES_MENU_PROBE"] == "1",
                          "the simulator cannot hold the menu open; set TVSCORES_MENU_PROBE=1 to probe by hand")
    }

    // MARK: Focus

    func testFocusStartsOnTheDayBeingShown() throws {
        try probeOnly()
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

    func testTheMenuOpensOnOnePressLeft() throws {
        try probeOnly()
        let app = Flow.launch()
        Flow.remote.press(.left)
        sleep(2)
        XCTAssertTrue(Flow.menuIsOpen(app), "one press left from the pills opens the menu")
    }

    func testTheMenuOpensFromARowToo() throws {
        try probeOnly()
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

    func testTheMenuStaysOpenUntilDismissed() throws {
        try probeOnly()
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

    func testTheMenuIsStillOpenSixSecondsIn() throws {
        try probeOnly()
        // A bracket for the test above: the earlier probes saw the menu shut
        // between one and five seconds after opening. Green here and red
        // above says the refresh; red here says something sooner.
        let app = Flow.launch()
        Flow.openMenu(app)
        sleep(6)
        let open = Flow.menuIsOpen(app)
        if !open { Flow.reportFocus(app, "after the menu shut within six seconds") }
        XCTAssertTrue(open, "the menu is still open six seconds after opening")
    }

    func testTheMenuStaysOpenOnceThePageHasSettled() throws {
        try probeOnly()
        // The crests and portraits behind the page keep arriving for some
        // seconds after launch, each one redrawing its row. A menu opened
        // after that has settled tells whether those arrivals are what shuts
        // it: green here and red above says they are.
        let app = Flow.launch()
        sleep(30)
        Flow.openMenu(app)
        sleep(40)
        let open = Flow.menuIsOpen(app)
        if !open { Flow.reportFocus(app, "after the menu shut on a settled page") }
        XCTAssertTrue(open, "the menu opened on a settled page is still open forty seconds later")
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

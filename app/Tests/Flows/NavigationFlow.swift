import XCTest

/// What joins the screens: how the menu opens and shuts, where focus goes,
/// and that a press takes you where it says and back again.
///
/// The menu is ours since 2026-09-28 — plain views, not tvOS's sidebar —
/// which is what lets these run: the simulator never held the system's
/// sidebar open, so every one of these was a probe run by hand until then.
final class NavigationFlow: FlowCase {

    // MARK: The menu

    func testTheMenuOpensFromTheDaySwitchOnTheCurrentRow() {
        let app = Flow.launch()
        Flow.openMenu(app)
        XCTAssertTrue(Flow.menuRow(app).hasFocus, "focus lands on Home, the page being shown")
    }

    func testTheMenuOpensFromARowToo() {
        let app = Flow.launch()
        let first = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: first, limit: 12), "focus reaches the first match row")
        Flow.openMenu(app)
    }

    func testTheMenuStaysOpenAcrossARefresh() {
        // The fault on the television: open, then shut on its own. The demo
        // board reloads every 30 s while a match is live in it.
        let app = Flow.launch()
        Flow.openMenu(app)
        sleep(35)
        let open = Flow.menuIsOpen(app)
        if !open { Flow.reportFocus(app, "after the menu shut on its own") }
        XCTAssertTrue(open, "the menu is still open thirty-five seconds and a refresh later")
    }

    func testRightShutsTheMenuAndFocusIsBackOnThePage() {
        let app = Flow.launch()
        Flow.openMenu(app)
        Flow.remote.press(.right)
        sleep(1)
        XCTAssertFalse(Flow.menuIsOpen(app), "right shuts the menu")
        XCTAssertTrue(Flow.focusOnPage(app).exists, "and focus is on the page")
    }

    func testBackOpensTheMenuAndBackAgainLeavesTheApp() {
        // The way out of an app, which App Review checks: Back from the top
        // opens the menu, and Back in the menu leaves, as tvOS's own does.
        let app = Flow.launch()
        Flow.focusThePage()
        Flow.remote.press(.menu)
        sleep(1)
        XCTAssertTrue(Flow.menuIsOpen(app), "Back on a page opens the menu")
        Flow.remote.press(.menu)
        XCTAssertTrue(app.wait(for: .runningBackground, timeout: 8), "Back in the menu leaves the app")
    }

    func testPickingACompetitionLowInTheMenuOpensIt() {
        // NFL, near the bottom: the row tvOS's own sidebar could not be
        // left from. Picked, it opens its page and shuts the menu.
        let app = Flow.launch()
        Flow.openMenu(app)
        let nfl = Flow.menuRow(app, "menu.nfl.4391")
        XCTAssertTrue(Flow.walk(.down, until: nfl, limit: 25), "focus walks down the menu to NFL")
        Flow.remote.press(.select)
        app.buttons["AFC"].firstMatch.appears(within: 10)
        XCTAssertFalse(Flow.menuIsOpen(app), "the menu shut")
        sleep(1)
        XCTAssertTrue(Flow.day(app, "today").hasFocus, "focus is on NFL's page, on the day it shows, not the first pill")
        Flow.openMenu(app)
        XCTAssertTrue(nfl.hasFocus, "and left opens the menu again, on NFL")
    }

    func testHomeFromTheMenuReturnsToTheFrontPage() {
        let app = Flow.launch(league: "f1")
        app.buttons["Drivers"].firstMatch.appears(within: 10)
        Flow.focusThePage()
        Flow.openMenu(app)
        XCTAssertTrue(Flow.walk(.up, until: Flow.menuRow(app), limit: 25), "focus walks up to Home")
        Flow.remote.press(.select)
        app.buttons["league.football.4501"].appears(within: 10)
        XCTAssertFalse(app.buttons["Drivers"].firstMatch.exists, "and the Formula 1 page is gone")
    }

    // MARK: Between screens

    func testARaceOpensFromItsRowAndBackReturnsToItsCompetition() {
        // A race opened from the Formula 1 page comes back to Formula 1, not
        // to Home: each competition's page has its own navigation.
        let app = Flow.launch(tab: "yesterday", league: "f1", extra: ["-TVScoresSample", "race"])
        app.buttons["Drivers"].firstMatch.appears(within: 10)
        Flow.focusThePage()
        let race = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'race.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: race, limit: 10), "focus reaches the race row")
        Flow.remote.press(.select)
        app.staticTexts["Race Result"].appears(within: 10)
        Flow.remote.press(.menu)
        app.buttons["Drivers"].firstMatch.appears(within: 8)
        XCTAssertFalse(app.staticTexts["Race Result"].exists, "back leaves the race, on the competition it was opened from")
    }

    func testAMatchOpensItsPageAndBackPutsItAway() {
        // The game's page rises over the list as a sheet; Back puts it away
        // and the remote is on the list again.
        let app = Flow.launch()
        let first = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: first, limit: 12), "focus reaches the first match row")
        Flow.remote.press(.select)
        let page = app.descendants(matching: .any)["game.header"].firstMatch
        XCTAssertTrue(page.waitForExistence(timeout: 8), "the game's page opens")
        sleep(1)
        XCTAssertTrue(Flow.focusOnPage(app).exists, "and the remote has somewhere to be on it")
        Flow.remote.press(.menu)
        sleep(1)
        XCTAssertFalse(page.exists, "Back puts the page away")
        XCTAssertFalse(Flow.menuIsOpen(app), "without opening the menu")
    }
}

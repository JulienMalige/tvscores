import XCTest

/// What joins the screens: the tab bar coming and going, focus landing where
/// it should, and a press taking you where it says and back again.
///
/// The flows before this one each prove a screen; this one proves the moves
/// between them. The tab bar is the system's — it reports focus, switches on
/// focus, and hides when focus moves back down — so unlike the sidebar it
/// replaced, all of that can be asserted from the outside.
final class NavigationFlow: FlowCase {

    func testUpBringsTheTabBarDownOnTheCurrentTab() {
        let app = Flow.launch(tab: "today")
        app.buttons["league.football.4501"].appears()
        Flow.showTabBar(app, current: "Today")
        XCTAssertTrue(Flow.tab(app, "Yesterday").exists && Flow.tab(app, "Competitions").exists, "the whole bar is there")
    }

    func testDownLeavesTheTabBarForThePage() {
        let app = Flow.launch(tab: "today")
        let header = app.buttons["league.football.4501"]
        header.appears()
        Flow.showTabBar(app, current: "Today")
        Flow.remote.press(.down)
        usleep(400_000)
        XCTAssertFalse(Flow.tab(app, "Today").hasFocus, "the bar has let go")
        let onPage = app.buttons.matching(NSPredicate(format: "hasFocus == 1 AND (identifier BEGINSWITH 'match.' OR identifier BEGINSWITH 'league.')"))
        XCTAssertEqual(onPage.count, 1, "and focus is on a row or heading of the page")
    }

    func testSwitchingTabsByFocusSwitchesThePage() {
        let app = Flow.launch(tab: "today")
        Flow.showTabBar(app, current: "Today")
        XCTAssertTrue(Flow.walk(.right, until: Flow.tab(app, "Competitions"), limit: 4))
        XCTAssertTrue(app.staticTexts["page.competitions"].waitForExistence(timeout: 8), "Competitions is shown as soon as its tab is focused")
        XCTAssertTrue(Flow.walk(.left, until: Flow.tab(app, "Yesterday"), limit: 4))
        XCTAssertTrue(app.staticTexts["page.yesterday"].waitForExistence(timeout: 8), "and Yesterday the same way back")
    }

    func testPickingADayOnACompetitionPageKeepsFocusOnIt() {
        // A competition's page keeps the day pills. Picking one restyles the
        // pill; focus must stay on it, not fall to the leading pill.
        let app = Flow.launch(league: "f1")
        app.buttons["table.drivers"].appears(within: 10)
        Flow.focusThePage()
        // Up from wherever the page put us, until a pill has focus.
        for _ in 0..<12 where !Flow.aDayPillIsFocused(app) {
            Flow.remote.press(.up)
            usleep(150_000)
        }
        XCTAssertTrue(Flow.aDayPillIsFocused(app), "focus reaches the day pills")
        XCTAssertTrue(Flow.walk(.right, until: app.buttons["day.upcoming"], limit: 3))
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertTrue(app.buttons["day.upcoming"].hasFocus, "the pill just picked keeps focus while its list is swapped in")
    }

    func testARaceOpensFromItsRowAndBackReturnsToItsCompetition() {
        // A race opened from the Formula 1 page comes back to Formula 1, not
        // to the list of competitions: the page is pushed on the same stack.
        let app = Flow.launch(tab: "yesterday", league: "f1", extra: ["-TVScoresSample", "race"])
        app.buttons["table.drivers"].appears(within: 10)
        let race = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'race.'")).firstMatch
        XCTAssertTrue(Flow.walk(.down, until: race, limit: 10), "focus reaches the race row")
        Flow.remote.press(.select)
        app.staticTexts["Race Result"].appears(within: 10)
        Flow.remote.press(.menu)
        app.buttons["table.drivers"].appears(within: 8)
        XCTAssertFalse(app.staticTexts["Race Result"].exists, "back leaves the race, on the competition it was opened from")
    }
}

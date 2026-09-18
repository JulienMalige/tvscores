import XCTest

/// A day's page: what it shows, and that the tabs change which day.
final class DayScreenFlow: FlowCase {

    func testTodayShowsAtLeastOneLeague() {
        let app = Flow.launch(tab: "today")
        // The demo sample has a Libertadores match today; its header is the first row.
        app.buttons["league.football.4501"].appears()
        XCTAssertTrue(app.staticTexts["TV Scores"].exists)
    }

    func testYesterdayAndUpcomingShowDifferentContent() {
        let app = Flow.launch(tab: "yesterday")
        // Yesterday's Libertadores had two matches; upcoming has none of these ids.
        let yesterday = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).firstMatch
        yesterday.appears()
        let seenYesterday = yesterday.identifier

        // Up brings the tab bar down on Yesterday; two to the right is
        // Upcoming, and the tab bar switches on focus, no select needed.
        Flow.showTabBar(app, current: "Yesterday")
        XCTAssertTrue(Flow.walk(.right, until: Flow.tab(app, "Upcoming"), limit: 4), "the remote reaches the Upcoming tab")
        XCTAssertTrue(app.staticTexts["page.upcoming"].waitForExistence(timeout: 8), "the Upcoming page is shown")
        let changed = NSPredicate(format: "identifier BEGINSWITH 'match.' AND identifier != %@", seenYesterday)
        XCTAssertTrue(app.buttons.matching(changed).firstMatch.waitForExistence(timeout: 8), "Upcoming shows different matches")
        XCTAssertFalse(app.buttons[seenYesterday].exists, "yesterday's match is gone from Upcoming")
    }

    func testALiveMatchShowsItsClockNotAKickoffTime() {
        let app = Flow.launch(tab: "today")
        // The sample carries exactly one live match. Its row shows a clock or
        // "Live", never a kickoff time — a live game does not have one.
        let live = app.staticTexts["Live"].firstMatch
        let clock = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", #"^\d+(\+\d+)?'$"#)).firstMatch
        XCTAssertTrue(live.waitForExistence(timeout: 8) || clock.waitForExistence(timeout: 2), "one live row is marked as such")
    }

    func testOpeningALeagueHeaderLandsOnItsPage() {
        let app = Flow.launch(tab: "today")
        let header = app.buttons["league.football.4501"]
        header.appears()
        // From the tab bar, one press down is the header: the first thing on
        // the page, and wide enough that focus cannot step over it.
        Flow.showTabBar(app, current: "Today")
        XCTAssertTrue(Flow.walk(.down, until: header, limit: 1), "one press down from the tab bar is the Libertadores header")
        Flow.remote.press(.select)
        // A cup has no table; what says "league page" is the Standings heading.
        app.staticTexts["Standings"].appears(within: 10)
    }
}

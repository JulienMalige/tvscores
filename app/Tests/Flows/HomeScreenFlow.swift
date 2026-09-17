import XCTest

/// The front page: what it shows, and that the day pills change what it shows.
final class HomeScreenFlow: FlowCase {

    func testMainScreenShowsTodayWithAtLeastOneLeague() {
        let app = Flow.launch(tab: "today")
        app.buttons["day.today"].appears()
        // The demo sample has a Libertadores match today; its header is the first row.
        app.buttons["league.football.4501"].appears()
        XCTAssertTrue(app.staticTexts["TV Scores"].exists)
    }

    func testYesterdayAndUpcomingShowDifferentContent() {
        let app = Flow.launch(tab: "yesterday")
        app.buttons["day.yesterday"].appears()
        // Yesterday's Libertadores had two matches; upcoming has none of these ids.
        let yesterday = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).firstMatch
        yesterday.appears()
        let seenYesterday = yesterday.identifier

        // Move focus to the Upcoming pill and select it. The list below is
        // lazy, so a header far down does not exist yet; the first match does.
        XCTAssertTrue(Flow.walk(.right, until: app.buttons["day.upcoming"]), "the remote reaches the Upcoming pill")
        Flow.remote.press(.select)
        let changed = NSPredicate(format: "identifier BEGINSWITH 'match.' AND identifier != %@", seenYesterday)
        XCTAssertTrue(app.buttons.matching(changed).firstMatch.waitForExistence(timeout: 8), "Upcoming shows different matches")
        XCTAssertFalse(app.buttons[seenYesterday].exists, "yesterday's match is gone from Upcoming")
    }

    func testALiveMatchShowsItsClockNotAKickoffTime() {
        let app = Flow.launch(tab: "today")
        app.buttons["day.today"].appears()
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
        XCTAssertTrue(Flow.walk(.down, until: header), "focus reaches the Libertadores header")
        Flow.remote.press(.select)
        // A cup has no table; what says "league page" is the Standings heading.
        app.staticTexts["Standings"].appears(within: 10)
    }
}

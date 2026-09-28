import XCTest

/// A competition's page: its own games, and the table under them.
final class LeagueScreenFlow: FlowCase {

    func testFormulaOneIsReachableWithNoRaceThisWeek() {
        // The whole reason the sidebar exists: F1 races every other weekend,
        // and its page — and championship — used to vanish in between.
        let app = Flow.launch(league: "f1")
        app.buttons["Drivers"].firstMatch.appears(within: 10)
        app.buttons["Constructors"].firstMatch.appears()
        app.buttons["standing.1"].appears()
    }

    func testDriversAndConstructorsAreTwoTablesWithLineUps() {
        let app = Flow.launch(league: "f1", extra: ["-TVScoresTable", "constructors"])
        app.buttons["standing.1"].appears(within: 10)
        // Constructors carry their drivers under the marque.
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS ','")).firstMatch.exists,
                      "a constructor row names its drivers, comma separated")
    }

    func testDriversTableShowsTheTeamUnderEachDriver() {
        let app = Flow.launch(league: "f1", extra: ["-TVScoresTable", "drivers"])
        app.buttons["standing.1"].appears(within: 10)
        XCTAssertTrue(app.staticTexts["Mercedes"].firstMatch.exists, "a driver row shows the team as its subtitle")
    }

    func testMotoGPTeamsHaveTheirMarquesAndRiders() {
        let app = Flow.launch(league: "motogp", extra: ["-TVScoresTable", "teams"])
        app.buttons["standing.1"].appears(within: 10)
        XCTAssertTrue(app.staticTexts["Aprilia Racing"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS ','")).firstMatch.exists,
                      "riders under the marque, the same as Formula 1")
    }

    func testADomesticLeagueShowsItsTable() {
        // The first football league by name: Brasileirão in the sample. Its
        // table sits under its games, so the remote has to walk down to it.
        let app = Flow.launch(league: "football")
        app.staticTexts["Standings"].appears(within: 10)
        let leader = app.buttons["standing.1"]
        XCTAssertTrue(Flow.walk(.down, until: leader, limit: 40), "focus walks down to the top of the table")
        XCTAssertTrue(app.buttons["standing.20"].exists, "and the table has twenty rows")
    }

    func testADomesticTableReadsAsColumnsWithItsZones() {
        let app = Flow.launch(league: "football")
        app.staticTexts["Standings"].appears(within: 10)
        XCTAssertTrue(Flow.walk(.down, until: app.buttons["standing.1"], limit: 40), "focus walks down to the top of the table")
        XCTAssertTrue(app.staticTexts["col.pts"].firstMatch.exists, "the column names head the table")
        XCTAssertTrue(app.descendants(matching: .any)["table.cut.solid"].exists, "a line under the Libertadores places")
        XCTAssertTrue(Flow.walk(.down, until: app.buttons["standing.20"], limit: 30), "and down to the bottom")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Relegation'")).firstMatch.exists, "the legend says what the places mean")
    }

    func testAConferenceIsReadDivisionByDivision() {
        let app = Flow.launch(league: "nfl")
        app.staticTexts["Standings"].appears(within: 10)
        XCTAssertTrue(app.buttons["AFC"].firstMatch.exists && app.buttons["NFC"].firstMatch.exists, "two conferences to switch between")
        XCTAssertTrue(app.staticTexts["division.East"].firstMatch.waitForExistence(timeout: 8), "the first division heads its four teams")
        XCTAssertTrue(app.staticTexts["col.pct"].firstMatch.exists, "with the record's columns over them")
    }

    func testACompetitionBetweenSeasonsSaysWhenItIsBack() {
        // The sample's NBA is back in a fortnight, so the card says "Coming
        // up"; further out it says "Offseason". Either way it carries the
        // sentence with the date or the month.
        let app = Flow.launch(league: "nba")
        app.staticTexts["offseason"].firstMatch.appears(within: 10)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'NBA'")).firstMatch.exists, "and says when it is back")
        XCTAssertFalse(Flow.day(app, "today").exists, "no day switch: there is no day to switch to")
    }

    func testTennisNamesItsTournamentWithItsFlag() {
        // The sample's WTA has two Beijing matches on Upcoming, copied from
        // the live board with their tournament.
        let app = Flow.launch(tab: "upcoming", league: "wta")
        let heading = app.descendants(matching: .any)["tournament.Beijing"]
        XCTAssertTrue(heading.waitForExistence(timeout: 10), "the matches sit under their tournament's heading")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'WTA 1000'")).firstMatch.exists, "with its tier")
    }
}

/// Every competition's page must give the remote something to stand on.
///
/// A page with nothing focusable leaves focus nowhere, and from nowhere a
/// press left goes nowhere: the menu cannot be opened and the only way out
/// is to quit the app. The television's trace showed exactly that on Copa
/// Libertadores between rounds (build 24): a page of a "coming up" card and
/// no table. This walks every competition in the sample, whatever it has
/// on — games, a table, only a card — and asks the one question. Failed
/// on build 24's code for NBA alone (2026-09-28), passes since.
final class EveryPageTakesFocusFlow: FlowCase {

    /// The sample's fifteen, by the id the launch argument matches on.
    private static let competitions = [
        ("4351", "Brasileirão"), ("4331", "Bundesliga"), ("4501", "Copa Libertadores"),
        ("4335", "La Liga"), ("4334", "Ligue 1"), ("4328", "Premier League"),
        ("4332", "Serie A"), ("4480", "UEFA Champions League"), ("4481", "UEFA Europa League"),
        ("f1", "Formula 1"), ("motogp", "MotoGP"), ("atp", "ATP Tour"), ("wta", "WTA Tour"),
        ("4387", "NBA"), ("4391", "NFL"),
    ]

    func testEveryCompetitionPageHoldsFocus() {
        var dead: [String] = []
        for (id, name) in Self.competitions {
            // Every competition section carries the Standings heading,
            // tables or not: it is the sign the page is up.
            let app = Flow.launch(league: id)
            Flow.focusThePage()
            sleep(1)
            let onPage = app.descendants(matching: .any)
                .matching(NSPredicate(format: "hasFocus == 1 AND NOT (identifier BEGINSWITH 'menu.')"))
                .firstMatch
            if !onPage.exists {
                Flow.reportFocus(app, "on \(name)'s page")
                dead.append(name)
            } else {
                print("TREE| \(name): focus on \(onPage.identifier.isEmpty ? onPage.label : onPage.identifier)")
            }
            app.terminate()
        }
        XCTAssertEqual(dead, [], "pages where nothing can take focus, so left cannot open the menu")
    }
}


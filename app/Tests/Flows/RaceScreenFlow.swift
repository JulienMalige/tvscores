import XCTest

/// A race: its card over the page, the podium, then everyone, each row
/// reachable by remote.
final class RaceScreenFlow: FlowCase {

    func testClassificationListsFinishersInOrderAndIsScrollable() {
        // A week with a classified Grand Prix in it, whatever this week holds.
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"], ready: "Race Result")
        // A row's identifier sits on its texts; the row itself is a focusable
        // stack with no element of its own, so it is the winner's name we find.
        let winner = app.staticTexts.matching(identifier: "result.1").firstMatch
        XCTAssertTrue(winner.waitForExistence(timeout: 12), "the winner's row is on the page")
        // The Grand Prix under its series, "Formula 1 · Spanish Grand Prix".
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Spanish Grand Prix'")).firstMatch.exists)
        // tvOS scrolls by moving focus, which is what broke when the rows were
        // not focusable: the tenth finisher starts below the screen and must
        // come up into it as the remote walks down.
        let tenth = app.staticTexts.matching(identifier: "result.10").firstMatch
        XCTAssertTrue(tenth.exists, "the tenth finisher is in the list")
        XCTAssertGreaterThan(tenth.frame.minY, 1080, "and starts below the fold")
        Flow.focusThePage()
        for _ in 0..<14 where tenth.frame.maxY > 1000 {
            Flow.remote.press(.down)
            usleep(250_000)
        }
        XCTAssertLessThan(tenth.frame.maxY, 1000, "walking down brought it onto the screen")
    }

    func testARaceStillToComeShowsTheGridOnceQualifyingIsRun() {
        // The sample's Saturday: Bahrain's qualifying is classified, the race is tomorrow.
        let app = Flow.launch(tab: "today", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1:grid"], ready: "Starting Grid")
        XCTAssertTrue(app.staticTexts.matching(identifier: "grid.1").firstMatch.waitForExistence(timeout: 12), "pole is on the grid")
        XCTAssertTrue(app.staticTexts["1 M. Verstappen"].exists, "and in the front row under the header")
        XCTAssertFalse(app.staticTexts["Race Result"].exists, "no result before the race")
    }

    func testBackReturnsToWhereTheRaceWasOpened() {
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"], ready: "Race Result")
        sleep(1) // let the card settle before asking to leave it
        Flow.focusThePage()
        Flow.remote.press(.menu)
        XCTAssertTrue(Flow.day(app, "yesterday").waitForExistence(timeout: 8), "back lands on the day the race was opened from")
        XCTAssertTrue(app.staticTexts["Race Result"].waitForNonExistence(timeout: 5), "and the race page is gone")
    }
}

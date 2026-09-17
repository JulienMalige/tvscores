import XCTest

/// A race: the podium, then everyone, each row reachable by remote.
final class RaceScreenFlow: FlowCase {

    func testClassificationListsFinishersInOrderAndIsScrollable() {
        // A week with a classified Grand Prix in it, whatever this week holds.
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"])
        // A row's identifier sits on its texts; the row itself is a focusable
        // stack with no element of its own, so it is the winner's name we find.
        let winner = app.staticTexts.matching(identifier: "result.1").firstMatch
        XCTAssertTrue(winner.waitForExistence(timeout: 12), "the winner's row is on the page")
        XCTAssertTrue(app.staticTexts["Spanish Grand Prix"].exists)
        // tvOS scrolls by moving focus, which is what broke when the rows were
        // not focusable: the tenth finisher starts below the screen and must
        // come up into it as the remote walks down.
        let tenth = app.staticTexts.matching(identifier: "result.10").firstMatch
        XCTAssertTrue(tenth.exists, "the tenth finisher is in the list")
        XCTAssertGreaterThan(tenth.frame.minY, 1080, "and starts below the fold")
        for _ in 0..<14 where tenth.frame.maxY > 1000 {
            Flow.remote.press(.down)
            usleep(250_000)
        }
        XCTAssertLessThan(tenth.frame.maxY, 1000, "walking down brought it onto the screen")
    }

    func testBackReturnsToWhereTheRaceWasOpened() {
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"])
        XCTAssertTrue(app.staticTexts["Race Result"].waitForExistence(timeout: 12), "the race page is open")
        sleep(1) // let the push settle before asking to leave it
        Flow.remote.press(.menu)
        XCTAssertTrue(app.buttons["day.yesterday"].waitForExistence(timeout: 8), "back lands on the day the race was opened from")
        XCTAssertFalse(app.staticTexts["Race Result"].exists, "and the race page is gone")
    }
}

import XCTest

/// A race: the podium, then everyone, each row reachable by remote.
final class RaceScreenFlow: FlowCase {

    func testClassificationListsFinishersInOrderAndIsScrollable() {
        // A week with a classified Grand Prix in it, whatever this week holds.
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"])
        let winner = app.otherElements["result.1"].firstMatch
        XCTAssertTrue(winner.waitForExistence(timeout: 12) || app.buttons["result.1"].waitForExistence(timeout: 2),
                      "the winner's row is on the page")
        // tvOS scrolls by moving focus: the tenth row must be reachable, which
        // is what broke when the rows were not focusable.
        let tenth = app.descendants(matching: .any)["result.10"]
        XCTAssertTrue(Flow.walk(.down, until: tenth, limit: 40), "focus walks down to the tenth finisher")
    }

    func testBackReturnsToWhereTheRaceWasOpened() {
        let app = Flow.launch(tab: "yesterday", extra: ["-TVScoresSample", "race", "-TVScoresRace", "f1"])
        XCTAssertTrue(app.descendants(matching: .any)["result.1"].waitForExistence(timeout: 12))
        Flow.remote.press(.menu)
        app.buttons["day.yesterday"].appears()
    }
}

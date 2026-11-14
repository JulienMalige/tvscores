import XCTest

/// The question about sharing usage (docs/analytics.md): up over the front
/// page once the board is in, answered with the remote, and the answer is
/// what Settings, Usage Data says. The simulator is never asked on its
/// own, so the flow asks for the question with `-TVScoresAskConsent`.
final class UsageQuestionFlow: FlowCase {
    func testDontShareLeavesTheSwitchOff() {
        let app = answer("Don't Share")
        XCTAssertEqual(usageSwitch(app), "Off")
    }

    func testShareTurnsTheSwitchOn() {
        let app = answer("Share")
        XCTAssertEqual(usageSwitch(app), "On")
    }

    /// Launches with the question, and answers it with the remote.
    private func answer(_ choice: String, file: StaticString = #filePath, line: UInt = #line) -> XCUIApplication {
        let app = Flow.launch(extra: ["-TVScoresAskConsent"])
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "the question comes up over the page", file: file, line: line)
        XCTAssertEqual(alert.label, "Help improve TV Scores?", "in words, not keys", file: file, line: line)
        // Side by side on a television, Share holding the focus at first.
        let button = alert.buttons[choice].firstMatch
        let reached = Flow.walk(.left, until: button, limit: 3) || Flow.walk(.right, until: button, limit: 3)
        XCTAssertTrue(reached, "the remote reaches \(choice)", file: file, line: line)
        Flow.remote.press(.select)
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: alert)
        XCTAssertEqual(XCTWaiter().wait(for: [gone], timeout: 5), .completed, "the answer puts the question away", file: file, line: line)
        return app
    }

    /// Settings, from the gear at the top of the menu, then Usage Data: what
    /// its switch says.
    private func usageSwitch(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) -> String? {
        Flow.openMenu(app, file: file, line: line)
        XCTAssertTrue(Flow.walk(.up, until: app.buttons["menu.settings"], limit: 6), "focus reaches the gear", file: file, line: line)
        Flow.remote.press(.select)
        let row = app.buttons["settings.privacy"]
        XCTAssertTrue(row.waitForExistence(timeout: 8), "Settings lists Usage Data", file: file, line: line)
        XCTAssertTrue(Flow.walk(.down, until: row, limit: 8), "the remote reaches it", file: file, line: line)
        Flow.remote.press(.select)
        let toggle = app.buttons["settings.usage"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 8), "its page has the switch", file: file, line: line)
        return toggle.value as? String
    }
}

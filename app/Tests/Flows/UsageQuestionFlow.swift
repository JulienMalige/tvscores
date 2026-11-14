import XCTest

/// The question about sharing usage (docs/analytics.md): up over the front
/// page once the board is in, answered with the remote, and the answer is
/// what Settings, Privacy says. The simulator is never asked on its own, so
/// the flow asks for the question with `-TVScoresAskConsent`.
final class UsageQuestionFlow: FlowCase {
    func testDontShareLeavesTheSwitchOff() {
        let app = answer("Don\u{2019}t Share")
        XCTAssertEqual(privacySwitch(app), "Off")
    }

    func testShareTurnsTheSwitchOn() {
        let app = answer("Share")
        XCTAssertEqual(privacySwitch(app), "On")
    }

    /// Launches with the question, and answers it with the remote.
    private func answer(_ choice: String, file: StaticString = #filePath, line: UInt = #line) -> XCUIApplication {
        let app = Flow.launch(extra: ["-TVScoresAskConsent"])
        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 10), "the question comes up over the page", file: file, line: line)
        XCTAssertTrue(alert.staticTexts["Help improve TV Scores?"].exists, "in words, not keys", file: file, line: line)
        let button = alert.buttons[choice]
        let reached = Flow.walk(.down, until: button, limit: 4) || Flow.walk(.up, until: button, limit: 4)
        XCTAssertTrue(reached, "the remote reaches \(choice)", file: file, line: line)
        Flow.remote.press(.select)
        let gone = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: alert)
        XCTAssertEqual(XCTWaiter().wait(for: [gone], timeout: 5), .completed, "the answer puts the question away", file: file, line: line)
        return app
    }

    /// Settings, from the gear at the top of the menu: what the Privacy row says.
    private func privacySwitch(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) -> String? {
        Flow.openMenu(app, file: file, line: line)
        XCTAssertTrue(Flow.walk(.up, until: app.buttons["menu.settings"], limit: 6), "focus reaches the gear", file: file, line: line)
        Flow.remote.press(.select)
        let row = app.buttons["settings.usage"]
        XCTAssertTrue(row.waitForExistence(timeout: 8), "Settings has the Privacy switch", file: file, line: line)
        return row.value as? String
    }
}

import XCTest

/// Settings, Competitions: a press on a competition ticks or unticks it and
/// does nothing else; holding select on it offers to move it.
final class SettingsScreenFlow: FlowCase {
    /// The demo board's first two football competitions, in the list's order.
    private let first = "settings.league.football:4351"
    private let second = "settings.league.football:4331"

    private func open() -> XCUIApplication {
        let app = Flow.launch(extra: ["-TVScoresSettings", "competitions"], ready: "Competitions")
        XCTAssertTrue(Flow.walk(.down, until: app.buttons[first]), "the first competition has the focus")
        return app
    }

    func testAPressTicksOrUnticksACompetitionAndNothingElse() {
        // Build 47: the row's tick and its move handle shared one focus, so
        // a press hid the competition and lifted it to be moved as well.
        let app = open()
        let row = app.buttons[first]
        XCTAssertTrue(row.isSelected, "shown to begin with")
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertFalse(row.isSelected, "one press hides it")
        XCTAssertTrue(row.isEnabled && row.hasFocus, "and leaves it where it was, not lifted to be moved")
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertTrue(row.isSelected, "a second press shows it again")
    }

    func testHoldingSelectMovesACompetitionDownAndBackUp() {
        let app = open()
        let row = app.buttons[first], next = app.buttons[second]
        XCTAssertLessThan(row.frame.minY, next.frame.minY)
        move(app, "Move Down")
        XCTAssertGreaterThan(row.frame.minY, next.frame.minY, "it is now below the one that followed it")
        XCTAssertTrue(row.isSelected, "and still shown: holding select only moves it")
        move(app, "Move Up")
        XCTAssertLessThan(row.frame.minY, next.frame.minY, "and back in its place")
    }

    /// Holds select on the focused competition and picks `choice` in the menu that opens.
    private func move(_ app: XCUIApplication, _ choice: String, file: StaticString = #filePath, line: UInt = #line) {
        Flow.remote.press(.select, forDuration: 1.5)
        let item = app.buttons[choice]
        XCTAssertTrue(item.waitForExistence(timeout: 5), "holding select opens a menu with \(choice)", file: file, line: line)
        XCTAssertTrue(Flow.walk(.down, until: item, limit: 4), "\(choice) can be reached", file: file, line: line)
        Flow.remote.press(.select)
        sleep(2)
    }
}

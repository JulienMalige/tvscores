import XCTest

/// Settings, Competitions: a press on a competition ticks or unticks it and
/// does nothing else; holding select on it offers to move it.
final class SettingsScreenFlow: FlowCase {
    /// The demo board's first two football competitions, in the list's order.
    private let first = "settings.league.football:4351"
    private let second = "settings.league.football:4331"

    /// A competition's row: the list's cell takes the focus, and the button
    /// in it says whether the competition is shown.
    private func row(_ app: XCUIApplication, _ id: String) -> XCUIElement {
        app.cells.containing(.button, identifier: id).firstMatch
    }

    private func open() -> XCUIApplication {
        let app = Flow.launch(extra: ["-TVScoresSettings", "competitions"], ready: "Competitions")
        XCTAssertTrue(Flow.walk(.down, until: row(app, first)), "the first competition has the focus")
        return app
    }

    func testAPressTicksOrUnticksACompetitionAndNothingElse() {
        // Build 47: the row's tick and its move handle shared one focus, so
        // a press hid the competition and lifted it to be moved as well.
        let app = open()
        let tick = app.buttons[first]
        XCTAssertTrue(tick.isSelected, "shown to begin with")
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertFalse(tick.isSelected, "one press hides it")
        XCTAssertTrue(tick.isEnabled && row(app, first).hasFocus, "and leaves it where it was, not lifted to be moved")
        Flow.remote.press(.select)
        sleep(1)
        XCTAssertTrue(tick.isSelected, "a second press shows it again")
    }

    func testHoldingSelectMovesACompetitionDownAndBackUp() {
        let app = open()
        let top = { self.row(app, self.first).frame.minY }
        let below = { self.row(app, self.second).frame.minY }
        XCTAssertLessThan(top(), below())
        move(app, "Move Down")
        XCTAssertGreaterThan(top(), below(), "it is now below the one that followed it")
        XCTAssertTrue(app.buttons[first].isSelected, "and still shown: holding select only moves it")
        move(app, "Move Up")
        XCTAssertLessThan(top(), below(), "and back in its place")
    }

    /// Holds select on the focused competition and takes `choice`, the first
    /// the menu that opens offers (Move Up is greyed on the first row).
    private func move(_ app: XCUIApplication, _ choice: String, file: StaticString = #filePath, line: UInt = #line) {
        Flow.remote.press(.select, forDuration: 1.5)
        XCTAssertTrue(app.descendants(matching: .any)[choice].waitForExistence(timeout: 5),
                      "holding select opens a menu with \(choice)", file: file, line: line)
        Flow.remote.press(.select)
        sleep(2)
    }
}

import XCTest

/// What every flow test starts from: the app in demo mode, in Julien's time
/// zone, on the tab the test asks for — and a remote to drive it.
///
/// tvOS has no touch. Everything a person can do is a press on the Siri
/// Remote, so that is what these tests do, through `XCUIRemote`.
enum Flow {
    /// `ready` names what proves the page is up. The day switch is the default;
    /// a flow that launches straight into a race passes the race page's own
    /// heading instead, since the switch is underneath it by then.
    static func launch(tab: String = "today", league: String? = nil, extra: [String] = [], ready: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-TVScoresDemo", "-TVScoresTab", tab, "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        if let league { app.launchArguments += ["-TVScoresLeague", league] }
        app.launchArguments += extra
        app.launchEnvironment["TZ"] = "America/Sao_Paulo"
        app.launch()
        // The app shows a loader until its first board and its competition
        // marks are in; on a busy runner that can take a while. Every page
        // has the day switch, so the segment for the tab asked for is the
        // sign the page is up — waited for here, once, rather than hoped for
        // in each test's first assertion.
        // A competition's page may have no day switch — between seasons it
        // shows when it is back instead — so its sign is the Standings heading.
        let sign = ready.map { app.staticTexts[$0] } ?? (league == nil ? day(app, tab) : app.staticTexts["Standings"])
        XCTAssertTrue(sign.waitForExistence(timeout: 25), "the app finished loading and shows \(ready ?? "the \(tab) pill")")
        return app
    }

    static var remote: XCUIRemote { .shared }

    /// A pill of the day switch, by the day it shows, found by its English label.
    static func day(_ app: XCUIApplication, _ day: String) -> XCUIElement {
        app.buttons[day.prefix(1).uppercased() + day.dropFirst()].firstMatch
    }

    /// Press until `element` is focused or `limit` presses have gone by.
    /// Focus is the only cursor a television has; a test walks, it does not tap.
    static func walk(_ direction: XCUIRemote.Button, until element: XCUIElement, limit: Int = 25) -> Bool {
        for _ in 0..<limit {
            if element.exists && element.hasFocus { return true }
            remote.press(direction)
            usleep(150_000)
        }
        return element.exists && element.hasFocus
    }

    // MARK: The system sidebar

    /// A row of the menu, as the tree reports it. Collapsed, the sidebar still
    /// lists every row — disabled, at 0×0 — so `exists` says nothing about
    /// whether the menu is open. A row that is open has a frame.
    static func menuRow(_ app: XCUIApplication, _ name: String = "Formula 1") -> XCUIElement { app.buttons[name].firstMatch }
    static func menuIsOpen(_ app: XCUIApplication) -> Bool {
        let row = menuRow(app)
        return row.exists && row.frame.width > 0 && row.isEnabled
    }

    /// Focus left from the page opens the sidebar — for a moment. The
    /// simulator shuts it again within a second or two (see NavigationFlow),
    /// so whatever a flow does in the menu it does straight after this.
    static func openMenu(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        // Never called with focus on the day switch: left along it moves
        // between its pills, which is not the menu.
        for _ in 0..<3 {
            remote.press(.left)
            sleep(2)
            if menuIsOpen(app) { return }
        }
        XCTAssertTrue(menuIsOpen(app), "pressing left opens the menu: its rows have frames", file: file, line: line)
    }

    /// A page opened by launch argument arrives with focus still in the
    /// sidebar — a person opens a page from a focused row and never lands
    /// this way. A press right puts focus on the page, as theirs would be.
    static func focusThePage() {
        // One press, not two: the second would move along the day switch
        // and pick another day, and the page under test would change.
        remote.press(.right)
        usleep(400_000)
    }

    /// Where focus is, for the log: the one fact that separates "the page
    /// took focus back" from "the menu closed on its own". The heaviest
    /// query there is; ask only once something has already gone wrong.
    static func reportFocus(_ app: XCUIApplication, _ when: String) {
        let focused = app.descendants(matching: .any).matching(NSPredicate(format: "hasFocus == 1")).allElementsBoundByIndex
        let names = focused.prefix(3).map { "\($0.elementType.rawValue):\($0.identifier.isEmpty ? $0.label : $0.identifier)" }
        print("TREE| focus \(when): \(names.isEmpty ? "nowhere" : names.joined(separator: ", "))")
    }
}

extension XCUIElement {
    /// Waits, then reports — so a failure says what it waited for.
    @discardableResult
    func appears(within seconds: TimeInterval = 8, file: StaticString = #filePath, line: UInt = #line) -> Bool {
        let ok = waitForExistence(timeout: seconds)
        XCTAssertTrue(ok, "expected \(self) within \(seconds)s", file: file, line: line)
        return ok
    }
}


/// Every flow's base: when an assertion fails, the accessibility tree the
/// remote was looking at goes into the log — the only window onto a simulator
/// nobody is sitting in front of.
class FlowCase: XCTestCase {
    private var dumped = false

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    override func record(_ issue: XCTIssue) {
        if !dumped {
            dumped = true
            // Each line carries a marker the CI log filter lets through, so the
            // tree is readable from the run's console without downloading a
            // result bundle.
            print("TREE| === accessibility tree at failure: \(name) ===")
            Flow.reportFocus(XCUIApplication(), "at failure")
            for line in XCUIApplication().debugDescription.split(separator: "\n") { print("TREE| \(line)") }
            print("TREE| === end ===")
        }
        super.record(issue)
    }
}

import XCTest

/// What every flow test starts from: the app in demo mode, in Julien's time
/// zone, on the tab the test asks for — and a remote to drive it.
///
/// tvOS has no touch. Everything a person can do is a press on the Siri
/// Remote, so that is what these tests do, through `XCUIRemote`.
enum Flow {
    /// `ready` names what proves the page is up. The day pills are the default;
    /// a flow that launches straight into a race passes the race page's own
    /// heading instead, since the pills are underneath it by then.
    static func launch(tab: String = "today", league: String? = nil, extra: [String] = [], ready: String? = nil) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-TVScoresDemo", "-TVScoresTab", tab, "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        if let league { app.launchArguments += ["-TVScoresLeague", league] }
        app.launchArguments += extra
        app.launchEnvironment["TZ"] = "America/Sao_Paulo"
        app.launch()
        // The app shows a loader until its first board and its competition
        // marks are in; on a busy runner that can take a while. Every page
        // has the day pills, so the pill for the tab asked for is the sign
        // the page is up — waited for here, once, rather than hoped for in
        // each test's first assertion.
        let sign = ready.map { app.staticTexts[$0] } ?? app.buttons["day.\(tab)"]
        XCTAssertTrue(sign.waitForExistence(timeout: 25), "the app finished loading and shows \(ready ?? "the \(tab) pill")")
        return app
    }

    static var remote: XCUIRemote { .shared }

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
            for line in XCUIApplication().debugDescription.split(separator: "\n") { print("TREE| \(line)") }
            print("TREE| === end ===")
        }
        super.record(issue)
    }
}

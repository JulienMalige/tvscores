import XCTest

/// What every flow test starts from: the app in demo mode, in Julien's time
/// zone, on the tab the test asks for — and a remote to drive it.
///
/// tvOS has no touch. Everything a person can do is a press on the Siri
/// Remote, so that is what these tests do, through `XCUIRemote`.
enum Flow {
    static func launch(tab: String = "today", league: String? = nil, extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-TVScoresDemo", "-TVScoresTab", tab, "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        if let league { app.launchArguments += ["-TVScoresLeague", league] }
        app.launchArguments += extra
        app.launchEnvironment["TZ"] = "America/Sao_Paulo"
        app.launch()
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

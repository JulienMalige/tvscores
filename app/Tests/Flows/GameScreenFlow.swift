import XCTest

/// A game's page: what it says about where to watch.
final class GameScreenFlow: FlowCase {

    func testAGameToComeSaysHowToWatchIt() {
        // The demo board gives its first NFL game channels and the apps that carry them;
        // in the demo's country (the US) that is ESPN's own app, a streamer, and the
        // league's own app last (the NFL's, as the competition complement).
        let app = Flow.launch(extra: ["-TVScoresGame", "scheduled:nfl:tv"], ready: "How to Watch")
        XCTAssertTrue(app.buttons["watch.espn"].waitForExistence(timeout: 10), "ESPN's app is a card")
        XCTAssertTrue(app.buttons["watch.nfl"].exists, "and the NFL's own app, last")
        XCTAssertFalse(app.buttons["watch.canalplus"].exists, "no French app: the demo's country is the US")
    }
}

/// Settings, Apps to show: every app How to Watch can offer, to turn off.
final class AppsSettingsFlow: FlowCase {
    func testTheAppsToShowAreListedForTheCountryChosen() {
        // The demo's country is the US: ESPN and Disney+ are US apps; CANAL+ is French.
        let app = Flow.launch(extra: ["-TVScoresSettings", "apps"], ready: "Apps to show")
        XCTAssertTrue(app.buttons["settings.app.espn"].waitForExistence(timeout: 10), "ESPN is listed under the United States")
        XCTAssertTrue(app.buttons["settings.app.disneyplus"].exists)
        XCTAssertFalse(app.buttons["settings.app.canalplus"].exists, "and a French app is not, with only the US chosen")
    }
}

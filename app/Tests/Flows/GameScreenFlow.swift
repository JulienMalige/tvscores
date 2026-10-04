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

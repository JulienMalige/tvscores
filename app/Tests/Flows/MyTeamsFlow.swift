import XCTest

/// My Teams: the followed sides first on Home, their page, and choosing them.
final class MyTeamsFlow: FlowCase {

    /// The demo's Today has Flamengo in the Libertadores and the Bills in the NFL.
    private let followed = ["-TVScoresFollow", "football:flamengo,nfl:buffalo-bills"]

    func testHomeOpensWithTheFollowedGamesAndTheirHeadingOpensMyTeams() {
        let app = Flow.launch(tab: "today", extra: followed)
        let heading = app.buttons["home.myTeams"]
        heading.appears()
        XCTAssertTrue(app.descendants(matching: .any)["followed.football:flamengo"].exists, "a star before Flamengo's crest")
        XCTAssertTrue(Flow.walk(.down, until: heading), "focus reaches the My Teams heading")
        Flow.remote.press(.select)
        XCTAssertTrue(app.buttons["myTeams.edit"].waitForExistence(timeout: 8), "My Teams is up, with its button to choose")
        XCTAssertFalse(app.buttons["league.football.4501"].exists, "no competition's heading: only the followed games")
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'match.'")).count, 2, "Flamengo's game and the Bills'")
    }

    func testWithNobodyFollowedHomeIsAsBeforeAndMyTeamsAsksToChoose() {
        let app = Flow.launch(tab: "today")
        app.buttons["league.football.4501"].appears()
        XCTAssertFalse(app.buttons["home.myTeams"].exists, "no My Teams section with nobody followed")
        Flow.openMenu(app)
        XCTAssertTrue(Flow.walk(.down, until: Flow.menuRow(app, "menu.myTeams")), "the menu has My Teams under Home")
        Flow.remote.press(.select)
        let choose = app.buttons["myTeams.choose"]
        choose.appears()
        XCTAssertTrue(Flow.walk(.down, until: choose), "focus reaches Choose Teams")
        Flow.remote.press(.select)
        // The picker: a competition, then a press on a side stars it.
        let ligue1 = Flow.settingsRow(app, "chooseTeams.football.4334")
        XCTAssertTrue(ligue1.waitForExistence(timeout: 10), "the picker lists Ligue 1")
        XCTAssertTrue(Flow.walk(.down, until: ligue1, limit: 40), "focus reaches Ligue 1")
        Flow.remote.press(.select)
        let psg = Flow.settingsRow(app, "team.football:paris-saint-germain")
        XCTAssertTrue(psg.waitForExistence(timeout: 8), "Ligue 1's clubs are listed")
        XCTAssertTrue(Flow.walk(.down, until: psg, limit: 40), "focus reaches Paris Saint-Germain")
        Flow.remote.press(.select)
        XCTAssertTrue(app.buttons["team.football:paris-saint-germain"].isSelected, "a press stars the club")
    }

    func testWithTeamsFollowedUpFromTheDaySwitchReachesChooseTeams() {
        // Build 58: the button at the top right had nothing under it, and a
        // press up from the day switch went nowhere.
        let app = Flow.launch(tab: "today", extra: followed + ["-TVScoresMyTeams"])
        let choose = app.buttons["myTeams.edit"]
        choose.appears()
        XCTAssertTrue(Flow.walk(.up, until: choose, limit: 6), "a press up from the day switch reaches Choose Teams")
        Flow.remote.press(.select)
        XCTAssertTrue(Flow.settingsRow(app, "chooseTeams.football.4334").waitForExistence(timeout: 10), "the picker opens")
    }
}

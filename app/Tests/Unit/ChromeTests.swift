import Foundation
import Testing
@testable import TVScores

/// The chrome: what the Competitions list is built from, and what it is fed.
@Suite("Chrome")
struct ChromeTests {
    @Test("the league list survives a refresh that changed nothing but scores")
    @MainActor
    func leagueListIsStable() async {
        // The Competitions list is built from this. A fresh array twice a
        // minute would rebuild it under whoever is reading it. Same
        // competitions in, same array out.
        let store = ScoreboardStore(source: .bundled(), warmImages: false)
        await store.refresh()
        let first = store.leagues
        #expect(!first.isEmpty)
        await store.refresh()
        #expect(store.leagues == first)
    }

    @Test("the first board makes the app ready, and only the first")
    @MainActor
    func readyFlipsOnce() async {
        let store = ScoreboardStore(source: .bundled(), warmImages: false)
        #expect(!store.ready, "a loader stands in until the board lands")
        await store.refresh()
        #expect(store.ready)
        #expect(store.error == nil)
    }

    @Test("every league the list holds can be opened as a page")
    @MainActor
    func leaguesBecomeRefs() async {
        let store = ScoreboardStore(source: .bundled(), warmImages: false)
        await store.refresh()
        for league in store.leagues {
            let ref = LeagueRef(league)
            #expect(ref.leagueId == league.id.raw)
            #expect(ref.name == league.name, "the page carries the full name")
        }
    }
}

/// What the chrome is fed: the pictures, and in what order.
@Suite("Chrome/Pictures")
struct ChromePictureTests {
    private static func board() throws -> Scoreboard {
        let url = try #require(Bundle.main.url(forResource: "sample-scoreboard", withExtension: "json"))
        return try ScoreboardDecoder.make().decode(Scoreboard.self, from: Data(contentsOf: url))
    }

    @Test("the competition marks are warmed before anything else, both shapes of them")
    func marksComeFirst() throws {
        // The headings and the Competitions list are drawn from them, and
        // they are what the eye lands on first. So they head the list.
        let board = try Self.board()
        let urls = board.imageURLs.compactMap { $0 }
        let marks = Set(board.leagues.flatMap { [$0.logo, $0.icon] }.compactMap { $0 })
        #expect(Set(urls.prefix(marks.count)) == marks, "the first entries are exactly the marks")
        #expect(urls.count > marks.count, "and the crests and portraits follow")
    }

    @Test("a board whose marks never arrive still lets the app in")
    @MainActor
    func readyDoesNotWaitForever() async {
        // A slow line must not hold the app shut behind the loader: the marks
        // get a few seconds, then the screen is shown with whatever came. The
        // warm-up here never finishes, so it is the ceiling that lets us in.
        let store = ScoreboardStore(source: .bundled(), warmImages: true) { _ in
            try? await Task.sleep(for: .seconds(60))
        }
        let began = Date()
        await store.refresh()
        let waited = Date().timeIntervalSince(began)
        #expect(store.ready)
        #expect(waited >= 3 && waited < 8, "the marks were given their few seconds, and no more: \(waited)s")
    }

    @Test("a board that cannot be read is an error on screen, not a crash")
    @MainActor
    func missingBoardIsAnError() async {
        let store = ScoreboardStore(source: .bundled("no-such-sample"), warmImages: false)
        await store.refresh()
        #expect(store.error != nil)
        #expect(store.board == nil)
        #expect(!store.ready, "the loader gives way to the error, not to an empty page")
    }
}

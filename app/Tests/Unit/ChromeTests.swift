import Foundation
import Testing
@testable import TVScores

/// The chrome: what the menu is built from, and what it is fed.
@Suite("Chrome")
struct ChromeTests {
    @Test("the menu's league list survives a refresh that changed nothing but scores")
    @MainActor
    func leagueListIsStable() async {
        // The sidebar is built from this list. Handing it a fresh array twice a
        // minute rebuilt the menu under whoever was reading it — that was half
        // of "it opens and closes". Same competitions in, same array out.
        let store = ScoreboardStore(source: .bundled, warmImages: false)
        await store.refresh()
        let first = store.leagues
        #expect(!first.isEmpty)
        await store.refresh()
        #expect(store.leagues == first)
    }

    @Test("the first board makes the app ready, and only the first")
    @MainActor
    func readyFlipsOnce() async {
        let store = ScoreboardStore(source: .bundled, warmImages: false)
        #expect(!store.ready, "a loader stands in until the board lands")
        await store.refresh()
        #expect(store.ready)
        #expect(store.error == nil)
    }

    @Test("every league the menu lists can be opened as a page")
    @MainActor
    func leaguesBecomeRefs() async {
        let store = ScoreboardStore(source: .bundled, warmImages: false)
        await store.refresh()
        for league in store.leagues {
            let ref = LeagueRef(league)
            #expect(ref.leagueId == league.id.raw)
            #expect(ref.name == league.name, "the page carries the full name, not the menu's")
        }
    }
}

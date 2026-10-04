import Foundation
import Testing
@testable import TVScores

/// How to Watch: what the proxy describes, and what the television does with it.
@Suite("How to Watch")
struct WatchTests {
    private static func app(_ json: String) throws -> WatchApp {
        try JSONDecoder().decode(WatchApp.self, from: Data(json.utf8))
    }

    private static func event(_ watchOn: String) throws -> Event {
        let json = #"{"id":"x","sport":"football","kind":"match","start":"2026-10-04T10:00:00Z","status":{"state":"scheduled"},"watchOn":\#(watchOn)}"#
        return try ScoreboardDecoder.make().decode(Event.self, from: Data(json.utf8))
    }

    @Test("an app comes with one store id, one per country, or none when it is built in")
    func decodesStoreIds() throws {
        let one = try Self.app(#"{"name":"A","kind":"own","id":11}"#)
        #expect(one.id?.value(for: "FR") == 11)
        let split = try Self.app(#"{"name":"B","kind":"streamer","id":{"US":22,"BR":33},"schemes":["b://"],"icon":"https://proxy/v1/img/abc"}"#)
        #expect(split.id?.value(for: "BR") == 33)
        #expect(split.id?.value(for: "FR") != nil, "a country with no listing of its own takes one of the others")
        #expect(split.schemes == ["b://"] && split.icon != nil)
        let builtIn = try Self.app(#"{"name":"C","kind":"streamer","id":null,"builtIn":true}"#)
        #expect(builtIn.id == nil && builtIn.builtIn == true)
    }

    @Test("an app's links are its schemes first, then its store pages")
    @MainActor
    func linksInOrder() throws {
        let app = try Self.app(#"{"name":"B","kind":"streamer","id":22,"schemes":["b://"]}"#)
        let links = AppOpener.links(for: app, country: "US")
        #expect(links.first == "b://")
        #expect(links.contains("https://apps.apple.com/app/id22"))
        let builtIn = try Self.app(#"{"name":"C","kind":"streamer","id":null,"builtIn":true}"#)
        #expect(AppOpener.links(for: builtIn, country: "US").isEmpty, "nothing to try, and the page says so")
    }

    @Test("a game's cards are those of the countries chosen, in the proxy's order, each app once")
    @MainActor
    func cardsFollowTheCountries() throws {
        let apps = try ["a", "b", "c"].reduce(into: [String: WatchApp]()) {
            $0[$1] = try Self.app(#"{"name":"\#($1)","kind":"own","id":1}"#)
        }
        let event = try Self.event(#"{"FR":["a","b"],"US":["b","c"]}"#)
        #expect(event.watchCards(apps, in: ["FR", "US"]).map(\.key) == ["a", "b", "c"], "b is in both and is shown once")
        #expect(event.watchCards(apps, in: ["FR", "US"]).first { $0.key == "b" }?.country == "FR", "under the first country that has it")
        #expect(event.watchCards(apps, in: ["US"]).map(\.key) == ["b", "c"])
        #expect(event.watchCards(apps, in: []).isEmpty, "no country chosen, no card")
        #expect(event.watchCards(nil, in: ["FR"]).isEmpty, "a board with no apps says nothing")
    }

    @Test("an app turned off is offered on no game, and the choice is kept")
    @MainActor
    func hiddenAppsAreNotOffered() throws {
        let apps = try ["a", "b", "c"].reduce(into: [String: WatchApp]()) {
            $0[$1] = try Self.app(#"{"name":"\#($1)","kind":"own","id":1}"#)
        }
        let event = try Self.event(#"{"FR":["a","b","c"]}"#)
        #expect(event.watchCards(apps, in: ["FR"], hiding: ["b"]).map(\.key) == ["a", "c"])
        #expect(event.watchCards(apps, in: ["FR"], hiding: []).map(\.key) == ["a", "b", "c"], "nothing hidden by default")

        let defaults = UserDefaults(suiteName: "tvscores.test.\(UUID().uuidString)")!
        let choice = AppChoice(defaults: defaults)
        #expect(choice.isShown("b"))
        choice.toggle("b")
        #expect(!choice.isShown("b"))
        #expect(AppChoice(defaults: defaults).hidden == ["b"], "kept on this Apple TV")
        choice.toggle("b")
        #expect(AppChoice(defaults: defaults).hidden.isEmpty, "and turned back on")
    }

    @Test("the board names the countries an app has a tvOS version in")
    func decodesCountries() throws {
        let app = try Self.app(#"{"name":"A","kind":"own","id":1,"countries":["FR","BR"]}"#)
        #expect(app.countries == ["FR", "BR"])
    }
}

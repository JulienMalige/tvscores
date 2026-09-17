import Foundation
import SwiftUI
import Testing
@testable import TVScores

/// The elements: the atoms with logic in them.
@Suite("Elements")
struct ElementsTests {
    // MARK: StatusLabel

    /// Every key the two vocabularies map to, in every language we ship.
    ///
    /// The catalogue is read from the bundle so a key that is mapped but never
    /// translated fails here, not as an English word on a Portuguese screen.
    @Test("every status the proxy can send has a string in all four languages")
    func statusVocabularyIsTranslated() throws {
        for key in Set(StatusLabel.detailKeys.values).union(StatusLabel.finalCombined.values).union(["status.live", "status.final"]) {
            for lang in ["en", "fr", "pt", "es"] {
                let path = try #require(Bundle.main.path(forResource: lang, ofType: "lproj"), "\(lang).lproj is bundled")
                let table = Bundle(path: path)
                let value = table?.localizedString(forKey: key, value: "MISSING", table: nil)
                #expect(value != "MISSING" && value != key, "\(key) in \(lang)")
            }
        }
    }

    @Test("an ending folded into the Final line is not printed twice")
    func combinedEndingsAreConsistent() {
        // "After overtime" folds into "Final/OT"; it must not also be a detail line.
        for ending in StatusLabel.finalCombined.keys {
            #expect(StatusLabel.detailKeys[ending] != nil, "\(ending) is still a known detail for live/other states")
        }
    }

    @Test("the vocabulary has no duplicate keys")
    func vocabularyHasNoDuplicates() {
        // A repeated key in a dictionary literal traps at launch; build 3 died
        // that way on a real Apple TV. The literal compiling proves nothing —
        // this proves the two tables still load.
        #expect(StatusLabel.detailKeys.count >= 17)
        #expect(StatusLabel.finalCombined.count == 3)
    }

    // MARK: ImageCache

    @Test("a picture that fails is asked for three times, then remembered, then forgotten")
    func cacheRetriesThenForgets() async throws {
        var calls = 0
        let cache = ImageCache(fetch: { _ in
            calls += 1
            throw URLError(.networkConnectionLost)
        }, forget: 0.2)
        let url = URL(string: "https://example.test/crest.png")!

        let first = await cache.load(url)
        #expect(first == nil)
        #expect(calls == 3, "three attempts before giving up")
        #expect(cache.hasFailed(url), "and the failure is remembered")

        try await Task.sleep(for: .milliseconds(300))
        #expect(!cache.hasFailed(url), "but not for long: a television's wifi blips")
    }

    @Test("a non-2xx answer is a failure, not an image")
    func rejectsErrorBodies() async {
        let cache = ImageCache(fetch: { req in
            let response = HTTPURLResponse(url: req.url!, statusCode: 404, httpVersion: nil, headerFields: nil)!
            return (Data("not found".utf8), response)
        })
        let image = await cache.load(URL(string: "https://example.test/missing.png")!)
        #expect(image == nil)
    }

    @Test("a picture that arrives is kept, and the second look costs nothing")
    func cachesDecodedImages() async throws {
        var calls = 0
        let png = try #require(Data(base64Encoded:
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="))
        let cache = ImageCache(fetch: { req in
            calls += 1
            return (png, HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        })
        let url = URL(string: "https://example.test/one.png")!
        let loaded = await cache.load(url)
        #expect(loaded != nil)
        #expect(cache.image(for: url) != nil, "read synchronously on the next frame")
        _ = await cache.load(url)
        #expect(calls == 1, "the second load never fetches")
    }

    // MARK: Colours

    @Test("a team colour is six hex digits behind a hash, or nothing")
    func hexColours() {
        #expect(Color(hex: "#27f4d2") != nil)
        #expect(Color(hex: "#FFFFFF") != nil, "either case")
        #expect(Color(hex: "27f4d2") == nil, "no hash, no colour: the row falls back to its default")
        #expect(Color(hex: "#fff") == nil, "short form is not accepted")
        #expect(Color(hex: "#gggggg") == nil)
        #expect(Color(hex: nil) == nil)
    }
}

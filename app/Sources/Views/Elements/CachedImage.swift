import SwiftUI
import UIKit

/// Decoded images kept in memory for as long as the app runs.
///
/// `URLCache` holds the *bytes*, which spares the network but not the decode:
/// `AsyncImage` starts every appearance at its placeholder and decodes again,
/// so a crest flickered into a monogram each time a row was rebuilt — on a
/// refresh, on scrolling back, on switching between the drivers and teams
/// tabs. Holding the decoded image means the second look is instant.
final class ImageCache {
    static let shared = ImageCache()

    typealias Fetch = (URLRequest) async throws -> (Data, URLResponse)
    private let fetch: Fetch
    /// How long a failure is held against a URL before it is asked for again.
    private let forget: TimeInterval
    /// Attempts made, for a test to count; nothing else reads it.
    private(set) var attempts = 0

    init(fetch: @escaping Fetch = { try await URLSession.shared.data(for: $0) }, forget: TimeInterval = 60) {
        self.fetch = fetch
        self.forget = forget
    }

    private let memory: NSCache<NSURL, UIImage> = {
        let cache = NSCache<NSURL, UIImage>()
        // Crests and portraits are small; a board's worth is a few megabytes.
        // The cache sheds its oldest entries if the system wants the room.
        cache.totalCostLimit = 64 << 20
        return cache
    }()

    /// When a URL last came back as nothing. A picture that failed has a
    /// fallback; a picture that is still coming does not, or the fallback is
    /// what people see first and the real thing looks like a glitch replacing
    /// it. The time matters: a failure on a television's wifi is usually a
    /// blip, and remembering it for ever is how a crest never appears again.
    private var failedAt: [URL: Date] = [:]

    func image(for url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    func hasFailed(_ url: URL) -> Bool {
        guard let at = failedAt[url] else { return false }
        if Date().timeIntervalSince(at) > forget {
            failedAt[url] = nil
            return false
        }
        return true
    }

    /// The decoded image, from memory if it is there and from the proxy if not.
    ///
    /// Three attempts, because one dropped request used to cost a crest for
    /// the life of the screen: the row had already fallen back to its monogram
    /// and nothing asked again. A television shares its wifi with the rest of
    /// the house and the app opens a few dozen of these at once.
    @discardableResult
    func load(_ url: URL) async -> UIImage? {
        if let hit = image(for: url) { return hit }
        for attempt in 0..<3 {
            if attempt > 0 { try? await Task.sleep(for: .milliseconds(400 << attempt)) }
            var request = URLRequest(url: url)
            request.timeoutInterval = 15
            attempts += 1
            guard let (data, response) = try? await fetch(request) else { continue }
            guard (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                  let image = UIImage(data: data) else { continue }
            memory.setObject(image, forKey: url as NSURL, cost: data.count)
            failedAt[url] = nil
            return image
        }
        failedAt[url] = Date()
        return nil
    }
}

/// An image that shows its fallback only when there is nothing else coming.
///
/// While a picture is on its way the space is simply left empty: the fallback
/// is a monogram or a sport's symbol, and showing one for half a second before
/// the badge arrives is what made the app look like it was glitching rather
/// than loading.
struct CachedImage<Placeholder: View>: View {
    let url: URL?
    var contentMode: ContentMode = .fit
    @ViewBuilder var placeholder: () -> Placeholder

    @State private var loaded: UIImage?
    @State private var settled = false

    /// Read on every pass, not just after loading: a URL already in the cache
    /// draws on the first frame, which is what removes the flicker.
    private var image: UIImage? {
        loaded ?? url.flatMap { ImageCache.shared.image(for: $0) }
    }

    /// Nothing is coming: there is no URL, or the one we had came back empty.
    private var giveUp: Bool {
        guard let url else { return true }
        return settled && ImageCache.shared.hasFailed(url)
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else if giveUp {
                placeholder()
            } else {
                Color.clear
            }
        }
        .task(id: url) {
            guard let url else { settled = true; return }
            if ImageCache.shared.image(for: url) != nil { settled = true; return }
            loaded = await ImageCache.shared.load(url)
            settled = true
        }
    }
}

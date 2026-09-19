import Observation
import OSLog
import SwiftUI
import UIKit

/// A count that moves when a picture lands in the cache — coalesced, a few
/// times a second at most — so every slot on screen looks at the cache again.
/// A slot whose own request was cut short (a row rebuilt under it, a task
/// cancelled) still shows the picture once anyone's request brought it.
@MainActor
@Observable
final class ImageArrivals {
    static let shared = ImageArrivals()
    private(set) var count = 0
    private var pending = false

    func note() {
        guard !pending else { return }
        pending = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))
            pending = false
            count += 1
        }
    }
}

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
    private var attemptCount = 0
    var attempts: Int { lock.withLock { attemptCount } }

    /// A television's wifi sleeps between uses, and the first requests after
    /// it wakes fail outright; a session that waits for connectivity hands
    /// them to the network once it is there instead of reporting a loss.
    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()

    init(fetch: @escaping Fetch = { try await ImageCache.session.data(for: $0) }, forget: TimeInterval = 60) {
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
    ///
    /// Behind a lock, because the prefetcher loads four at a time while rows
    /// load their own: a Swift dictionary written from two tasks at once is
    /// memory corruption, and the flows caught the app dying that way.
    /// NSCache is safe on its own; this is the state around it that is not.
    private var failedAt: [URL: Date] = [:]
    private let lock = NSLock()

    func image(for url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    func hasFailed(_ url: URL) -> Bool {
        lock.withLock {
            guard let at = failedAt[url] else { return false }
            if Date().timeIntervalSince(at) > forget {
                failedAt[url] = nil
                return false
            }
            return true
        }
    }

    /// The decoded image, from memory if it is there and from the proxy if not.
    ///
    /// Three attempts, because one dropped request used to cost a crest for
    /// the life of the screen: the row had already fallen back to its monogram
    /// and nothing asked again. A television shares its wifi with the rest of
    /// the house and the app opens a few dozen of these at once.
    /// Every failure, with its reason, for the CI log and a television's
    /// console: "the first five crests are missing" has no other witness.
    private static let log = Logger(subsystem: "com.julienmalige.tvscores", category: "images")

    @discardableResult
    func load(_ url: URL) async -> UIImage? {
        if let hit = image(for: url) { return hit }
        for attempt in 0..<3 {
            // A second, then four: long enough for a sleeping wifi to wake,
            // short enough that a row is not blank for the page's life.
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(attempt == 1 ? 1 : 4))
                if Task.isCancelled { return nil }
            }
            var request = URLRequest(url: url)
            request.timeoutInterval = 15
            lock.withLock { attemptCount += 1 }
            let data: Data, response: URLResponse
            do {
                (data, response) = try await fetch(request)
            } catch {
                // A cancelled load is not a failed one: the row that asked
                // was torn down (the menu redrawing under it, a list
                // rebuilt) and its replacement will ask again. Counting it
                // marked every picture on the page as failed for a minute —
                // 2,432 times in one CI run — and drew blanks in their place.
                if Task.isCancelled || error is CancellationError { return nil }
                Self.log.error("attempt \(attempt + 1) \(url.lastPathComponent, privacy: .public): \(error.localizedDescription, privacy: .public)")
                continue
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 200
            guard (200..<300).contains(status), let image = UIImage(data: data) else {
                Self.log.error("attempt \(attempt + 1) \(url.lastPathComponent, privacy: .public): HTTP \(status) \(data.count) bytes\(status == 200 ? ", not an image" : "")")
                continue
            }
            memory.setObject(image, forKey: url as NSURL, cost: data.count)
            lock.withLock { failedAt[url] = nil }
            Task { @MainActor in ImageArrivals.shared.note() }
            return image
        }
        lock.withLock { failedAt[url] = Date() }
        Self.log.error("gave up on \(url.lastPathComponent, privacy: .public)")
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
        return ImageCache.shared.hasFailed(url) || settled
    }

    var body: some View {
        // Read for its change alone: when any picture lands, look again.
        let _ = ImageArrivals.shared.count
        return Group {
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
            // A picture already in memory was drawn on the first frame; only
            // one that is not there yet has anything to record. One that
            // fails is asked for again while the row is still on screen —
            // twice, a minute apart — rather than left blank for good.
            guard let url, ImageCache.shared.image(for: url) == nil else { return }
            for _ in 0..<3 {
                loaded = await ImageCache.shared.load(url)
                if Task.isCancelled { return } // torn down; nothing to record
                settled = true
                if loaded != nil { return }
                try? await Task.sleep(for: .seconds(65))
                settled = false
            }
        }
    }
}

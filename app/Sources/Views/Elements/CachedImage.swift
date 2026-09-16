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

    private let memory: NSCache<NSURL, UIImage> = {
        let cache = NSCache<NSURL, UIImage>()
        // Crests and portraits are small; a board's worth is a few megabytes.
        // The cache sheds its oldest entries if the system wants the room.
        cache.totalCostLimit = 64 << 20
        return cache
    }()

    /// URLs that came back as nothing. A picture that failed has a fallback;
    /// a picture that is still coming does not, or the fallback is what people
    /// see first and the real thing looks like a glitch replacing it.
    private var failed: Set<URL> = []

    func image(for url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    func hasFailed(_ url: URL) -> Bool { failed.contains(url) }

    /// The decoded image, from memory if it is there and from the proxy if not.
    @discardableResult
    func load(_ url: URL) async -> UIImage? {
        if let hit = image(for: url) { return hit }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let image = UIImage(data: data) else {
            failed.insert(url)
            return nil
        }
        memory.setObject(image, forKey: url as NSURL, cost: data.count)
        return image
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

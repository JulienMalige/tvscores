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

    func image(for url: URL) -> UIImage? {
        memory.object(forKey: url as NSURL)
    }

    /// The decoded image, from memory if it is there and from the proxy if not.
    @discardableResult
    func load(_ url: URL) async -> UIImage? {
        if let hit = image(for: url) { return hit }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let image = UIImage(data: data) else { return nil }
        memory.setObject(image, forKey: url as NSURL, cost: data.count)
        return image
    }
}

/// An image that never shows its placeholder twice for the same URL.
struct CachedImage<Placeholder: View>: View {
    let url: URL?
    var contentMode: ContentMode = .fit
    @ViewBuilder var placeholder: () -> Placeholder

    @State private var loaded: UIImage?

    /// Read on every pass, not just after loading: a URL already in the cache
    /// draws on the first frame, which is what removes the flicker.
    private var image: UIImage? {
        loaded ?? url.flatMap { ImageCache.shared.image(for: $0) }
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else {
                placeholder()
            }
        }
        .task(id: url) {
            guard let url, ImageCache.shared.image(for: url) == nil else { return }
            loaded = await ImageCache.shared.load(url)
        }
    }
}

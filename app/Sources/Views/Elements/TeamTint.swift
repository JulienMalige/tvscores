import SwiftUI
import UIKit

/// A team's colour, read from its crest: the commonest strong colour in it.
/// Apple Sports tints a game's page with the two sides' colours; the feeds
/// give us none, but every crest carries its own. White, black and greys are
/// passed over — a crest's outline and ground, not its colour — so a black
/// and gold side comes out gold, and an all-black crest gives nothing.
enum TeamTint {
    static func of(_ team: TeamRef?) async -> Color? {
        guard let url = team?.logo, let image = await ImageCache.shared.load(url) else { return nil }
        return dominant(image)
    }

    private struct Bucket { var count = 0, r = 0, g = 0, b = 0 }

    static func dominant(_ image: UIImage) -> Color? {
        palette(image).first.map(\.color)
    }

    /// Both sides' colours, told apart. A crest's commonest colour first; an
    /// away side whose commonest is too near the home side's takes its next
    /// one, and white when it has none far enough — Turkey's red and Italy's
    /// made one bar of two on build 28 (Julien: "avoid too similar colors").
    static func pair(_ home: TeamRef?, _ away: TeamRef?) async -> (home: Color?, away: Color?) {
        async let h = palette(of: home)
        async let a = palette(of: away)
        let (homes, aways) = await (h, a)
        guard let first = homes.first else { return (nil, aways.first?.color) }
        // A crest that gave nothing — not loaded, or all black and white —
        // keeps the page's grey; white is for colours that are all too near.
        guard !aways.isEmpty else { return (first.color, nil) }
        let apart = aways.first { $0.distance(to: first) >= Self.apart }
        return (first.color, apart?.color ?? Color.white.opacity(0.85))
    }

    /// How far apart two colours must be to read as two bars: red against
    /// orange-red is 0.15 or so; red against blue or green over 0.6.
    static let apart = 0.3

    struct Swatch {
        let r, g, b: Double
        var color: Color { Color(red: r, green: g, blue: b) }
        func distance(to other: Swatch) -> Double {
            ((r - other.r) * (r - other.r) + (g - other.g) * (g - other.g) + (b - other.b) * (b - other.b)).squareRoot()
        }
    }

    private static func palette(of team: TeamRef?) async -> [Swatch] {
        guard let url = team?.logo, let image = await ImageCache.shared.load(url) else { return [] }
        return palette(image)
    }

    /// A crest's strong colours, commonest first: up to three.
    static func palette(_ image: UIImage) -> [Swatch] {
        guard let cg = image.cgImage else { return [] }
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let ctx = CGContext(data: buffer.baseAddress, width: side, height: side, bitsPerComponent: 8,
                                      bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))
            return true
        }
        guard drawn else { return [] }
        var buckets: [Int: Bucket] = [:]
        for i in stride(from: 0, to: pixels.count, by: 4) where pixels[i + 3] > 200 {
            let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
            let hi = max(r, g, b), lo = min(r, g, b)
            guard hi - lo > 50, hi > 60 else { continue }
            let key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5)
            var bucket = buckets[key, default: Bucket()]
            bucket.count += 1; bucket.r += r; bucket.g += g; bucket.b += b
            buckets[key] = bucket
        }
        // A few stray pixels are antialiasing, not a colour.
        return buckets.values.filter { $0.count >= 8 }.sorted { $0.count > $1.count }.prefix(3).map { top in
            let n = Double(top.count) * 255
            return Swatch(r: Double(top.r) / n, g: Double(top.g) / n, b: Double(top.b) / n)
        }
    }
}

extension TeamTint {
    /// The same reading of any mark by its address: a competition's logo,
    /// for a page the proxy names no colour for.
    static func of(logo url: URL?) async -> Color? {
        guard let url, let image = await ImageCache.shared.load(url) else { return nil }
        return dominant(image)
    }
}

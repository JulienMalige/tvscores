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
        guard let cg = image.cgImage else { return nil }
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let ctx = CGContext(data: buffer.baseAddress, width: side, height: side, bitsPerComponent: 8,
                                      bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))
            return true
        }
        guard drawn else { return nil }
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
        guard let top = buckets.values.max(by: { $0.count < $1.count }), top.count >= 8 else { return nil }
        let n = Double(top.count) * 255
        return Color(red: Double(top.r) / n, green: Double(top.g) / n, blue: Double(top.b) / n)
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

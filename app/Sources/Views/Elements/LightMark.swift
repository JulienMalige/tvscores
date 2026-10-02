import SwiftUI
import UIKit

/// A mark's own colour, and whether it can be seen on what it sits on.
/// Marks come made for one ground: the Champions League's white starball
/// vanished on a focused row's white (white focus since gone), the WTA's deep purple on the WTA's
/// purple page (Julien, build 28). Such a mark gets a thin outline in the
/// opposite tone — his idea over redrawing it: it keeps its colours.
/// Worked out once per picture, on a 24-point copy.
enum LightMark {
    struct Measure {
        /// Mostly near-white.
        let light: Bool
        /// Its edges are clear: a mark, not a picture on a ground. Only a
        /// mark can be outlined — a picture's silhouette is its rectangle.
        let cutOut: Bool
        /// The average colour of what is drawn, 0…1.
        let r, g, b: Double
        var luminance: Double { 0.2126 * r + 0.7152 * g + 0.0722 * b }
    }

    private final class Box { let measure: Measure?; init(_ m: Measure?) { measure = m } }
    private static let known = NSCache<NSURL, Box>()

    static func measure(_ image: UIImage, url: URL?) -> Measure? {
        if let url, let hit = known.object(forKey: url as NSURL) { return hit.measure }
        let m = measure(image)
        if let url { known.setObject(Box(m), forKey: url as NSURL) }
        return m
    }

    private static func measure(_ image: UIImage) -> Measure? {
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
        var opaque = 0, pale = 0, r = 0, g = 0, b = 0, clear = 0
        for i in stride(from: 0, to: pixels.count, by: 4) where pixels[i + 3] < 32 { clear += 1 }
        for i in stride(from: 0, to: pixels.count, by: 4) where pixels[i + 3] > 128 {
            opaque += 1
            let pr = Int(pixels[i]), pg = Int(pixels[i + 1]), pb = Int(pixels[i + 2])
            r += pr; g += pg; b += pb
            if min(pr, pg, pb) > 190 && max(pr, pg, pb) - min(pr, pg, pb) < 40 { pale += 1 }
        }
        guard opaque > 0 else { return nil }
        let n = Double(opaque) * 255
        return Measure(light: Double(pale) / Double(opaque) > 0.6,
                       cutOut: Double(clear) / Double(side * side) > 0.05, r: Double(r) / n, g: Double(g) / n, b: Double(b) / n)
    }

    /// Too near the ground to read: dark on dark, or close to the page's own
    /// colour. The ground is the page's tint, or the app's near-black.
    static func lost(_ m: Measure, on ground: Color?) -> Bool {
        var gr = 0.11, gg = 0.11, gb = 0.11
        if let ground {
            var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
            if UIColor(ground).getRed(&r, green: &g, blue: &b, alpha: &a) { gr = r; gg = g; gb = b }
        }
        let distance = ((m.r - gr) * (m.r - gr) + (m.g - gg) * (m.g - gg) + (m.b - gb) * (m.b - gb)).squareRoot()
        return m.luminance < 0.18 || distance < 0.2
    }
}

/// A fine solid outline for a mark that would vanish into what it sits on:
/// white on a dark or same-coloured page. (Dark on a focused row's white
/// went with the white, build 32: focus is glass now.) The
/// mark's silhouette, in the outline's tone, is laid behind it a point and
/// a half off in eight directions — a crisp edge, not a shadow's blur
/// (Julien, build 29: "a fine line, solid").
struct OnLightMark: ViewModifier {
    let image: UIImage
    let url: URL?
    let contentMode: ContentMode
    @Environment(\.pageTint) private var pageTint

    private static let width: CGFloat = 1.5
    private static let around: [CGSize] = (0..<8).map { i in
        let a = Double(i) * .pi / 4
        return CGSize(width: cos(a) * width, height: sin(a) * width)
    }

    func body(content: Content) -> some View {
        let m = LightMark.measure(image, url: url)
        if let m, m.cutOut, LightMark.lost(m, on: pageTint) {
            outlined(content, .white)
        } else {
            content
        }
    }

    private func outlined(_ content: Content, _ tone: Color) -> some View {
        ZStack {
            ForEach(Array(Self.around.enumerated()), id: \.offset) { _, shift in
                Image(uiImage: image)
                    .renderingMode(.template)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .foregroundStyle(tone.opacity(0.85))
                    .offset(shift)
            }
            content
        }
    }
}

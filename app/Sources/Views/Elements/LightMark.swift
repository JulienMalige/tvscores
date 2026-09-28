import SwiftUI
import UIKit

extension EnvironmentValues {
    /// The row under this view is lit white — the remote is on it. A mark
    /// drawn in white would vanish there.
    @Entry var onLightSurface = false
}

/// Whether a mark is mostly white: the Champions League's starball, the
/// friendlies' wordmark. Drawn as they come on the dark page, they vanish on
/// a focused row's white (Julien, build 28), so there they get a thin dark
/// outline — his idea over drawing them dark: the mark keeps its colours.
/// Coloured marks are left alone. Worked out once per picture, on a
/// 24-point copy.
enum LightMark {
    private static let known = NSCache<NSURL, NSNumber>()

    static func isLight(_ image: UIImage, url: URL?) -> Bool {
        if let url, let hit = known.object(forKey: url as NSURL) { return hit.boolValue }
        let light = measure(image)
        if let url { known.setObject(NSNumber(value: light), forKey: url as NSURL) }
        return light
    }

    private static func measure(_ image: UIImage) -> Bool {
        guard let cg = image.cgImage else { return false }
        let side = 24
        var pixels = [UInt8](repeating: 0, count: side * side * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let ctx = CGContext(data: buffer.baseAddress, width: side, height: side, bitsPerComponent: 8,
                                      bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: side, height: side))
            return true
        }
        guard drawn else { return false }
        var opaque = 0, pale = 0
        for i in stride(from: 0, to: pixels.count, by: 4) where pixels[i + 3] > 128 {
            opaque += 1
            let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
            if min(r, g, b) > 190 && max(r, g, b) - min(r, g, b) < 40 { pale += 1 }
        }
        // Most of what is drawn is near-white: a mark made for dark grounds.
        return opaque > 0 && Double(pale) / Double(opaque) > 0.6
    }
}

/// Outlines a light mark where the ground under it is light: tight shadows,
/// which trace the mark's edge and draw nothing on a dark ground.
struct OnLightMark: ViewModifier {
    let image: UIImage
    let url: URL?
    @Environment(\.onLightSurface) private var onLight

    func body(content: Content) -> some View {
        if onLight && LightMark.isLight(image, url: url) {
            content
                .shadow(color: .black.opacity(0.55), radius: 0.8)
                .shadow(color: .black.opacity(0.35), radius: 1.5)
        } else {
            content
        }
    }
}

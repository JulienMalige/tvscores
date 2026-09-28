import SwiftUI

/// The mark for a team: its crest from the proxy when there is one, otherwise a
/// coloured monogram. Same size as every other mark in a row.
struct TeamMark: View {
    let code: String
    var logo: URL? = nil
    var size: CGFloat = Metrics.mark

    var body: some View {
        Group {
            if let logo {
                CachedImage(url: logo) { monogram }
                    .padding(6)
            } else {
                monogram
            }
        }
        .frame(width: size, height: size)
    }

    private var monogram: some View {
        Text(code)
            .font(.system(size: size * 0.3, weight: .heavy))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(Color(hue: hue, saturation: 0.55, brightness: 0.55)))
    }

    /// Stable colour per code until real team colours exist.
    private var hue: Double {
        let h = code.unicodeScalars.reduce(7) { ($0 &* 31 &+ Int($1.value)) & 0xffff }
        return Double(h % 360) / 360
    }
}

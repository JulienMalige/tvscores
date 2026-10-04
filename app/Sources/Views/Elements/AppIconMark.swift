import SwiftUI

/// An app's icon as the Apple TV draws it: the tvOS app's own, a wide rectangle (5:3), from
/// its store listing through the proxy; the app's first letter on grey until it comes, or
/// for an app with none (Julien, 2026-10-04: "rectangular icon").
struct AppIconMark: View {
    let app: WatchApp
    /// A fixed height; nil lets the icon be as wide as the space it is given.
    var height: CGFloat? = Metrics.watchIconHeight

    private static let ratio: CGFloat = 5.0 / 3.0

    var body: some View {
        let corner = (height ?? Metrics.watchIconHeight) * 0.12
        let picture = Color.clear
            .aspectRatio(Self.ratio, contentMode: .fit)
            .overlay {
                CachedImage(url: app.icon) {
                    RoundedRectangle(cornerRadius: corner, style: .continuous)
                        .fill(.quaternary)
                        .overlay(Text(verbatim: String(app.name.prefix(1))).font(.title3.weight(.bold)))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
            .accessibilityHidden(true)
        if let height {
            picture.frame(width: height * Self.ratio, height: height)
        } else {
            picture.frame(maxWidth: .infinity)
        }
    }
}

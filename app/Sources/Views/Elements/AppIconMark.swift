import SwiftUI

/// An app's icon as the Apple TV draws it: the tvOS app's own, a wide rectangle (5:3), from
/// its store listing through the proxy; the app's first letter on grey until it comes, or
/// for an app with none (Julien, 2026-10-04: "rectangular icon on the left").
struct AppIconMark: View {
    let app: WatchApp
    var height: CGFloat = Metrics.watchIconHeight

    var body: some View {
        CachedImage(url: app.icon) {
            RoundedRectangle(cornerRadius: height * 0.12, style: .continuous)
                .fill(.quaternary)
                .overlay(Text(verbatim: String(app.name.prefix(1))).font(.title3.weight(.bold)))
        }
        .frame(width: height * 5 / 3, height: height)
        .clipShape(RoundedRectangle(cornerRadius: height * 0.12, style: .continuous))
        .accessibilityHidden(true)
    }
}

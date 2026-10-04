import SwiftUI

/// An app's icon, from its store listing through the proxy, rounded as Apple rounds
/// them; the app's first letter on grey until it comes, or for an app with none.
struct AppIconMark: View {
    let app: WatchApp
    var size: CGFloat = Metrics.watchIcon

    var body: some View {
        CachedImage(url: app.icon) {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(.quaternary)
                .overlay(Text(verbatim: String(app.name.prefix(1))).font(.title3.weight(.bold)))
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
        .accessibilityHidden(true)
    }
}

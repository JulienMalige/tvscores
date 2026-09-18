import SwiftUI

/// One competition in the sidebar, shaped the way tvOS shapes its own.
///
/// Every entry of the system sidebar — Apple TV, MLS, Disney+ — puts its mark
/// in the same square, so a wordmark and a crest sit on one vertical line and
/// no logo is larger than its neighbour. The square comes composed from the
/// proxy: tvOS lays sidebar icons out itself and discards any frame we put
/// round them, so a wide wordmark sent as-is towered over the crest beside it.
struct SidebarRow: View {
    let league: LeagueSummary

    /// The icon's square, matching the system's own sidebar icons.
    private static let icon: CGFloat = 56

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                FadingText(league.menu)
                if !league.playing {
                    Text("sidebar.noGames")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        } icon: {
            SidebarIcon(league: league, size: Self.icon)
        }
        .accessibilityIdentifier("tab.\(league.sport).\(league.id.raw)")
    }
}

/// A competition's icon in the menu, drawn once and never touched again.
///
/// A row of the sidebar is drawn by tvOS, and any state that changes inside
/// it after it appears makes tvOS rebuild the menu — which the reader sees as
/// the menu shutting a second or three after it opened. `CachedImage` records
/// its loading, so it cannot live here. This reads the cache at the moment
/// the row is drawn and holds no state at all: the icon is there if it was
/// warmed — the loader waits for exactly that — and the sport's symbol stands
/// in if it was not, until the menu is next opened. A missing icon for one
/// opening beats a menu that will not stay open.
private struct SidebarIcon: View {
    let league: LeagueSummary
    let size: CGFloat

    var body: some View {
        Group {
            if let url = league.icon ?? league.logo, let image = ImageCache.shared.image(for: url) {
                Image(uiImage: image).resizable().scaledToFit()
            } else {
                Image(systemName: Sport.icon(for: league.sport))
                    .font(.title3)
                    .foregroundStyle(Sport.tint(for: league.sport))
            }
        }
        .frame(width: size, height: size)
    }
}

/// A line of text that runs out rather than ending in an ellipsis.
///
/// Julien, on a truncated competition name: "shorten but not by …, it's
/// fading out" — which is what tvOS does to the sidebar entry it cannot fit.
struct FadingText: View {
    private let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lineLimit(1)
            .truncationMode(.tail)
            // `fixedSize` was tried first, to lay the whole line out and let
            // the row clip it. The sidebar re-proposes its own width and the
            // name wrapped to two lines instead, so the line is truncated and
            // the mask fades the last of it — the ellipsis included.
            .mask(
                LinearGradient(
                    stops: [.init(color: .black, location: 0.86), .init(color: .clear, location: 1)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }
}

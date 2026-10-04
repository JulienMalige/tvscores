import SwiftUI

/// "How to Watch", as the Apple TV app closes a game's page (Julien, 2026-10-03): one
/// small card per app that can show the game, side by side — the app's icon, its name,
/// and "Open" in grey (Julien, 2026-10-04: small rectangular cards, not a line each).
/// Selecting one opens the app on this Apple TV; when nothing opens, it says so under
/// the cards.
struct HowToWatchSection: View {
    let cards: [WatchCard]
    /// The app that would not open, for a line under the cards.
    @State private var failed: String?

    var body: some View {
        VStack(spacing: Metrics.watchCardGap) {
            Text("watch.title")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.bottom, 6)
            HStack(spacing: Metrics.watchCardGap) {
                ForEach(cards) { card in
                    Button {
                        Task {
                            let tried = await AppOpener.open(card.app, key: card.key, country: card.country)
                            failed = tried.contains { $0.opened } ? nil : card.app.name
                        }
                    } label: {
                        WatchTile(card: card)
                    }
                    .buttonStyle(QuietButtonStyle())
                    .accessibilityIdentifier("watch.\(card.key)")
                }
            }
            if let failed {
                Text("watch.unavailable \(failed)")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("watch.unavailable")
            }
        }
    }
}

/// A card: the icon over the name over "Open", the width shared with its neighbours.
private struct WatchTile: View {
    let card: WatchCard
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: 8) {
            AppIconMark(app: card.app)
            Text(verbatim: card.app.name)
                .font(.callout.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text("watch.openShort")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: Metrics.watchCardWidth)
        // A faint rectangle at rest, so they read as cards before one is focused.
        .rowSurface(focused: isFocused, resting: 0.08)
    }
}

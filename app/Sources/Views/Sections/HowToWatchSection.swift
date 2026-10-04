import SwiftUI

/// "How to Watch", as the Apple TV app closes a game's page (Julien, 2026-10-03): one
/// card per app that can show the game, the app's icon on the left, "Open in X" and
/// "X app" in grey beside it, an arrow at the end. Selecting one opens the app on this
/// Apple TV; when nothing opens, it says so under the cards.
struct HowToWatchSection: View {
    let cards: [WatchCard]
    /// The app that would not open, for a line under the cards.
    @State private var failed: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.watchCardGap) {
            Text("watch.title")
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.bottom, 6)
            ForEach(cards) { card in
                Button {
                    Task {
                        let tried = await AppOpener.open(card.app, key: card.key, country: card.country)
                        failed = tried.contains { $0.opened } ? nil : card.app.name
                    }
                } label: {
                    WatchCardRow(card: card)
                }
                .buttonStyle(QuietButtonStyle())
                .accessibilityIdentifier("watch.\(card.key)")
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

/// The app's icon, then what selecting it does, then an arrow.
private struct WatchCardRow: View {
    let card: WatchCard
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: Metrics.watchCardGap + 6) {
            AppIconMark(app: card.app)
            VStack(alignment: .leading, spacing: 4) {
                Text("watch.open \(card.app.name)").font(.headline)
                Text("watch.appOf \(card.app.name)").font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "arrow.up.forward.app").foregroundStyle(.secondary)
        }
        .rowSurface(focused: isFocused, resting: 0)
    }
}

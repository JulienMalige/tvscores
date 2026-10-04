import SwiftUI

/// "How to Watch": the Apple TV app's card (Julien's photo of its page for a film), several to a
/// line, as many as fit, three or four (Julien: "four, three or five cards each line, horizontal").
/// Selecting one opens the app on this Apple TV; when nothing opens, it says so under the cards.
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
            LazyVGrid(columns: [GridItem(.adaptive(minimum: Metrics.watchTileMin), spacing: Metrics.watchCardGap, alignment: .top)],
                      spacing: Metrics.watchCardGap) {
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

/// The Apple TV app's card, as it is (Julien's photo): the wide icon on the left, "Open In X" with
/// "X app" in grey beside it, the external-link mark at the right. Narrower, so several share a line.
private struct WatchTile: View {
    let card: WatchCard
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: Metrics.watchCardGap) {
            AppIconMark(app: card.app, height: Metrics.watchTileIconHeight)
            VStack(alignment: .leading, spacing: 2) {
                Text("watch.open \(card.app.name)").font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.85)
                Text("watch.appOf \(card.app.name)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 4)
            Image(systemName: "arrow.up.forward.app").font(.callout).foregroundStyle(.secondary)
        }
        // A faint rectangle at rest, so they read as cards before one is focused.
        .rowSurface(focused: isFocused, resting: 0.08, insetV: Metrics.watchTileInsetV, insetH: Metrics.watchTileInsetH)
    }
}

import SwiftUI

/// "How to Watch", in the Apple TV app's card (Julien, 2026-10-04, from its page for a film), but
/// several to a line, as many as fit, four or five (Julien: "four, three or five cards each line"):
/// the app's wide icon on top, "Open In X" with "X app" in grey under it, and the external-link
/// mark at the end. Selecting one opens the app on this Apple TV; when nothing opens, it says so
/// under the cards.
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

/// The wide icon over what selecting it does, with the external-link mark at the end.
private struct WatchTile: View {
    let card: WatchCard
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            AppIconMark(app: card.app, height: nil)
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("watch.open \(card.app.name)").font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                    Text("watch.appOf \(card.app.name)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 4)
                Image(systemName: "arrow.up.forward.app").font(.callout).foregroundStyle(.secondary)
            }
        }
        // A faint rectangle at rest, so they read as cards before one is focused.
        .rowSurface(focused: isFocused, resting: 0.08)
    }
}

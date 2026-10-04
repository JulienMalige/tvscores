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
            // Rows of even columns: the cards of a line share its height, whatever their names, and a
            // last line with fewer keeps the same widths.
            let perLine = Metrics.watchCardsPerLine
            let lines = stride(from: 0, to: cards.count, by: perLine).map { Array(cards[$0..<min($0 + perLine, cards.count)]) }
            Grid(horizontalSpacing: Metrics.watchCardGap, verticalSpacing: Metrics.watchCardGap) {
                ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                    GridRow {
                        ForEach(line) { card in
                            Button {
                                Task {
                                    let tried = await AppOpener.open(card.app, key: card.key, country: card.country)
                                    failed = tried.contains { $0.opened } ? nil : card.app.name
                                }
                            } label: {
                                WatchTile(card: card)
                            }
                            .buttonStyle(QuietButtonStyle())
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .accessibilityIdentifier("watch.\(card.key)")
                        }
                        ForEach(0..<(perLine - line.count), id: \.self) { _ in
                            Color.clear.frame(maxWidth: .infinity, maxHeight: 0)
                        }
                    }
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
            // A long name takes a second line rather than being cut off (Julien: option A); the block
            // keeps the room for it, so a row of cards is even.
            VStack(alignment: .leading, spacing: 2) {
                Text("watch.open \(card.app.name)").font(.callout.weight(.semibold)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Text("watch.appOf \(card.app.name)").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }

            Spacer(minLength: 4)
            Image(systemName: "arrow.up.forward.app").font(.callout).foregroundStyle(.secondary)
        }
        // As wide and as tall as the cell the grid gives it, so the card's surface fills it.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        // A faint rectangle at rest, so they read as cards before one is focused.
        .rowSurface(focused: isFocused, resting: 0.08, insetV: Metrics.watchTileInsetV, insetH: Metrics.watchTileInsetH)
    }
}

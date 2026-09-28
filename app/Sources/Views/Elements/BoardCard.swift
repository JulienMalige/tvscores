import SwiftUI

/// The panel a day's games sit on, as Apple Sports lays out its front page
/// and a competition's: the day switch across its top, a hair line, then
/// the games. The heading of a page stays above it, on the page.
struct BoardCard<Content: View>: View {
    @Binding var day: Day
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            DayTabs(selected: $day)
                .padding(.vertical, Metrics.cardInsetV / 2)
            Divider().overlay(Color.white.opacity(0.15))
            content()
                .padding(.vertical, Metrics.cardInsetV)
        }
        .padding(.horizontal, Metrics.cardInsetH / 2)
        .gameCardSurface()
    }
}

/// The hair line between two rows on a card, as Apple Sports draws it.
struct RowRule: View {
    var body: some View {
        Divider()
            .overlay(Color.white.opacity(0.12))
            .padding(.horizontal, Metrics.rowInsetH)
    }
}

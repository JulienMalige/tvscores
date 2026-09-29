import SwiftUI

/// The panel a day's games sit on, as Apple Sports lays out its front page
/// and a competition's: the day switch across its top, a hair line, then
/// the games. The heading of a page stays above it, on the page.
struct BoardCard<Content: View>: View {
    @Binding var day: Day
    @ViewBuilder var content: () -> Content
    /// The games can take focus. Not until the day switch has it: with the
    /// switch centred, tvOS put first focus on the first game, and the page
    /// then moved it up to the chosen day — a jump Julien saw on build 28.
    /// With nothing else to take, focus lands on the switch at once. A
    /// second at most, in case it never does.
    @State private var open = false

    var body: some View {
        VStack(spacing: 0) {
            DayTabs(selected: $day) { open = true }
                .padding(.vertical, Metrics.cardInsetV / 2)
            Divider().overlay(Color.white.opacity(0.15))
                .padding(.horizontal, 20)
            content()
                .disabled(!open)
                .padding(.vertical, Metrics.cardInsetV)
        }
        .task {
            try? await Task.sleep(for: .seconds(1))
            open = true
        }
        .gameCardSurface()
    }
}

/// The hair line between two rows on a card, as Apple Sports draws it.
struct RowRule: View {
    var body: some View {
        Divider()
            .overlay(Color.white.opacity(0.12))
            .padding(.horizontal, 20)
    }
}

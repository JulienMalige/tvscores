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
    /// second at most, in case it never does. A touch screen has no focus
    /// to wait for.
    #if os(tvOS)
    @State private var open = false
    #else
    @State private var open = true
    #endif

    var body: some View {
        VStack(spacing: 0) {
            DayTabs(selected: $day) { open = true }
                .padding(.vertical, Metrics.cardInsetV / 2)
            Divider().overlay(Color.white.opacity(0.15))
                .padding(.horizontal, .tv(20))
            content()
                .disabled(!open)
                // Room for a lit row, which grows 2%, inside the rounded edge.
                .padding(.horizontal, .tv(16))
                .padding(.vertical, Metrics.cardInsetV)
        }
        .task {
            try? await Task.sleep(for: .seconds(1))
            open = true
        }
        .gameCardSurface()
    }
}

/// Home's and My Teams' page: the heading and the card scrolling together,
/// at the page's width on the page's tint. Title and day switch scroll away
/// with the list: on a television a pinned bar saves no input, since
/// reaching them means moving focus up there anyway, and the focus engine
/// brings them back on screen when it does.
struct BoardPage<Content: View>: View {
    @ViewBuilder var content: () -> Content
    @Environment(\.pageScrolled) private var pageScrolled

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) { content() }
                .frame(maxWidth: Metrics.pageWidth)
                .frame(maxWidth: .infinity)
                .pageMargins()
        }
        // Scrolled away from the top, the menu chip drops its name.
        .onScrollGeometryChange(for: Bool.self, of: { $0.contentOffset.y > 60 }) { _, down in pageScrolled(down) }
        .pageTint(.homeTint)
    }
}

/// The hair line between two rows on a card, as Apple Sports draws it.
struct RowRule: View {
    var body: some View {
        Divider()
            .overlay(Color.white.opacity(0.12))
            .padding(.horizontal, .tv(20))
    }
}

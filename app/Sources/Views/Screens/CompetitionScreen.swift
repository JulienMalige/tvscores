import SwiftUI

/// One competition's page: its mark and name, then its day, games and table.
struct CompetitionScreen: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @State var day: Day
    @Environment(\.openMenu) private var openMenu
    @Environment(\.pageScrolled) private var pageScrolled
    /// The logo's own colour, read only when the proxy names none.
    @State private var logoTint: Color?

    /// The competition's brand colour from the proxy, chosen by hand as
    /// Apple Sports chooses its own; failing that, its logo's commonest
    /// colour, darkened so white text still reads on it; failing that, none.
    private var tint: Color? {
        Color(hex: ref.color) ?? logoTint?.mix(with: .black, by: 0.45)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                HStack(spacing: Metrics.headingGap) {
                    LeagueMark(sport: ref.sport, logo: ref.logo, symbolName: ref.symbol)
                    Text(ref.name)
                        .font(.system(size: 48, weight: .bold))
                    Spacer()
                    ClockLabel()
                }
                CompetitionSection(ref: ref, store: store, day: $day)
            }
            .frame(maxWidth: Metrics.pageWidth)
            .frame(maxWidth: .infinity)
            .pageMargins()
        }
        .scrollClipDisabled()
        // Scrolled away from the top, the menu chip drops its name.
        .onScrollGeometryChange(for: Bool.self, of: { $0.contentOffset.y > 60 }) { _, down in pageScrolled(down) }
        .pageTint(tint)
        .task(id: ref.logo) {
            guard Color(hex: ref.color) == nil else { return }
            logoTint = await TeamTint.of(logo: ref.logo)
        }
        // Back on a page opens the menu, as it does on tvOS's own sidebar.
        .onExitCommand(perform: openMenu)
    }
}

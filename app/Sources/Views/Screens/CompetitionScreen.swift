import SwiftUI

/// One competition's page: its mark and name, then its day, games and table.
struct CompetitionScreen: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @State var day: Day
    @Environment(\.openMenu) private var openMenu

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                HStack(spacing: Metrics.headingGap) {
                    LeagueMark(sport: ref.sport, logo: ref.logo, symbol: ref.symbol)
                    Text(ref.name)
                        .font(.system(size: 48, weight: .bold))
                    Spacer()
                    ClockLabel()
                }
                CompetitionSection(ref: ref, store: store, day: $day)
            }
            .pageMargins()
        }
        .scrollClipDisabled()
        // Back on a page opens the menu, as it does on tvOS's own sidebar.
        .onExitCommand(perform: openMenu)
    }
}

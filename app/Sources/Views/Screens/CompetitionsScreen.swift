import SwiftUI

/// Every competition we follow, playing this week or not, each a page of its own.
struct CompetitionsScreen: View {
    let store: ScoreboardStore
    /// The day a competition's page opens on.
    let day: Day
    @State private var path = NavigationPath()
    @State private var openedRequested = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                    header
                    LazyVStack(spacing: Metrics.rowGap) {
                        ForEach(store.leagues) { league in
                            CompetitionRow(league: league)
                        }
                    }
                }
                .pageMargins()
            }
            .tabDestinations(store: store, day: day)
        }
        // `-TVScoresLeague f1` opens that competition (CI screenshots and the
        // flows). On appearance as well as on the list arriving, for the same
        // reason as the race: the loader means the list is usually here first.
        .onAppear(perform: openRequestedLeague)
        .onChange(of: store.leagues.count) { _, _ in openRequestedLeague() }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("tab.competitions")
                .font(.system(size: 46, weight: .bold))
                .accessibilityIdentifier("page.competitions")
            Spacer()
            ClockLabel()
        }
    }

    private func openRequestedLeague() {
        let args = ProcessInfo.processInfo.arguments
        guard !openedRequested,
              let i = args.firstIndex(of: "-TVScoresLeague"), i + 1 < args.count,
              let hit = store.leagues.first(where: { $0.sport == args[i + 1] || $0.id.raw == args[i + 1] })
        else { return }
        var next = NavigationPath()
        next.append(LeagueRef(hit))
        path = next
        openedRequested = true
    }
}

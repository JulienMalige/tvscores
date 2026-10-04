import SwiftUI

/// The app's front page: one day of every league the proxy follows.
struct HomeScreen: View {
    let store: ScoreboardStore
    @Binding var day: Day
    /// Takes the viewer to a competition's own place in the menu.
    let openLeague: (LeagueRef) -> Void
    /// Held by the menu's owner, so it outlives this screen.
    @Binding var openedInitialRace: Bool
    @Environment(\.openMenu) private var openMenu
    @Environment(\.openGame) private var openGame
    @Environment(\.pageScrolled) private var pageScrolled

    var body: some View {
        ScrollView {
            // Title and day switch scroll away with the list. On a
            // television a pinned bar saves no input, since reaching them
            // means moving focus up there anyway, and the focus engine
            // brings them back on screen when it does.
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                header
                BoardCard(day: $day) { content }
            }
            .frame(maxWidth: Metrics.pageWidth)
            .frame(maxWidth: .infinity)
            .pageMargins()
        }
        // Scrolled away from the top, the menu chip drops its name.
        .onScrollGeometryChange(for: Bool.self, of: { $0.contentOffset.y > 60 }) { _, down in pageScrolled(down) }
        .pageTint(.homeTint)
        // Back on the page opens the menu, as on tvOS's own sidebar.
        .onExitCommand(perform: openMenu)
        // `-TVScoresRace f1` opens that series' latest classified race (CI
        // screenshots and the race flow). Checked on appearance as well as on
        // the board arriving: the loader in front of the sidebar means this
        // screen is usually mounted after the board is already here, and a
        // watcher for the arrival would then never fire.
        .onAppear(perform: openRequestedRace)
        .onChange(of: store.board == nil) { _, _ in openRequestedRace() }
    }

    private func openRequestedRace() {
        guard !openedInitialRace, let board = store.board, let wanted = Self.argument("-TVScoresRace") else { return }
        // With ":next" it opens the series' next weekend instead, not yet
        // run; with ":grid", one whose qualifying is run and race is not.
        let parts = wanted.split(separator: ":")
        guard let series = parts.first else { return }
        let races = Day.allCases.flatMap { board.groups(for: $0) }
            .filter { $0.sport == String(series) }
            .flatMap(\.events)
        let mode = parts.count > 1 ? String(parts[1]) : ""
        let race: Event? = switch mode {
        case "next": races.first { $0.status.state == .scheduled }
        case "grid": races.first { $0.startingGrid != nil && ($0.results ?? []).isEmpty }
        default: races.first { !($0.results ?? []).isEmpty }
        }
        guard let race else { return }
        openedInitialRace = true
        openGame(race)
    }

    /// The day's competitions as the viewer chose them in Settings: hidden
    /// ones left out, the rest in the menu's order (build 36).
    @MainActor
    static func arranged(_ groups: [LeagueGroup], leagues: [LeagueSummary]) -> [LeagueGroup] {
        let key = { (g: LeagueGroup) in "\(g.sport):\(g.league.id.raw)" }
        let order = SportSection.grouped(leagues).flatMap(\.leagues).map(Sidebar.key)
        let rank = Dictionary(order.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
        return groups.enumerated()
            .filter { LeagueChoice.shared.isShown(key($0.element)) }
            .sorted { (rank[key($0.element)] ?? Int.max, $0.offset) < (rank[key($1.element)] ?? Int.max, $1.offset) }
            .map(\.element)
    }

    private static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
        return nil
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("app.title")
                .font(.system(size: 46, weight: .bold))
            Spacer()
            if let board = store.board, board.isStale {
                Label("home.stale", systemImage: "exclamationmark.triangle")
                    .font(.callout)
                    .foregroundStyle(.orange)
            }
            ClockLabel()
        }
    }

    @ViewBuilder
    private var content: some View {
        if let board = store.board {
            let groups = Self.arranged(board.groups(for: day), leagues: board.leagues)
            if groups.isEmpty {
                EmptyDay(day: day)
            } else {
                LazyVStack(alignment: .leading, spacing: Metrics.sectionGap) {
                    if day == .upcoming {
                        let days = LeagueGroup.byDay(groups, now: board.generatedAt)
                        ForEach(days, id: \.day) { entry in
                            DaySection(day: entry.day, groups: entry.groups, ruled: entry.day != days.first?.day) { group in
                                LeagueSection(group: group, day: day, now: board.generatedAt, openLeague: openLeague)
                            }
                        }
                    } else {
                        ForEach(groups) { group in
                            LeagueSection(group: group, day: day, now: board.generatedAt, openLeague: openLeague)
                        }
                    }
                }
                .padding(.top, 4)
            }
        } else if let error = store.error {
            VStack(spacing: 12) {
                Text("home.error").font(.title3)
                Text(error).font(.callout).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 500)
        } else {
            ProgressView("home.loading")
                .frame(maxWidth: .infinity, minHeight: 500)
        }
    }

}

#Preview {
    Sidebar(store: ScoreboardStore())
}

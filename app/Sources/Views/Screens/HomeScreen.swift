import SwiftUI

/// The app's front page: one day of every league the proxy follows.
struct HomeScreen: View {
    let store: ScoreboardStore
    @Binding var day: Day
    /// Takes the viewer to a competition's own place in the menu.
    let openLeague: (LeagueRef) -> Void
    /// Takes the viewer to My Teams, from the "★ My Teams ›" heading.
    let openMyTeams: () -> Void
    @State private var favourites = Favourites.shared
    /// Held by the menu's owner, so it outlives this screen.
    @Binding var openedInitialRace: Bool
    #if os(tvOS)
    @Environment(\.openMenu) private var openMenu
    #endif
    @Environment(\.openGame) private var openGame

    var body: some View {
        BoardPage {
            header
            BoardCard(day: $day) { content }
        }
        .usagePage(.home(day))
        .onChange(of: day) { _, picked in Analytics.shared.track(.dayPicked(picked, on: "home")) }
        #if os(tvOS)
        // Back on the page opens the menu, as on tvOS's own sidebar.
        .onExitCommand(perform: openMenu)
        #else
        .navigationTitle(Text("app.title"))
        #endif
        // `-TVScoresRace f1` opens that series' latest classified race (CI
        // screenshots and the race flow). Checked on appearance as well as on
        // the board arriving: the loader in front of the sidebar means this
        // screen is usually mounted after the board is already here, and a
        // watcher for the arrival would then never fire.
        .onAppear(perform: openRequestedRace)
        .onChange(of: store.board == nil) { _, _ in openRequestedRace() }
    }

    private func openRequestedRace() {
        // "f1", "f1:next", "f1:grid": which weekend, read by `LaunchRequest`.
        guard !openedInitialRace, let board = store.board, let wanted = LaunchRequest.argument("-TVScoresRace"),
              let race = LaunchRequest.race(wanted, in: board) else { return }
        openedInitialRace = true
        openGame(race)
    }

    /// The day's competitions as the viewer chose them in Settings: hidden
    /// ones left out, the rest in the menu's order (build 36).
    @MainActor
    static func arranged(_ groups: [LeagueGroup], leagues: [LeagueSummary]) -> [LeagueGroup] {
        let key = { (g: LeagueGroup) in "\(g.sport):\(g.league.id.raw)" }
        let order = SportSection.grouped(leagues).flatMap(\.leagues).map(MenuItem.key)
        let rank = Dictionary(order.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
        return groups.enumerated()
            .filter { LeagueChoice.shared.isShown(key($0.element)) }
            .sorted { (rank[key($0.element)] ?? Int.max, $0.offset) < (rank[key($1.element)] ?? Int.max, $1.offset) }
            .map(\.element)
    }

    /// The app's name and the clock over the day, on a television. A phone
    /// has its name in the navigation bar and the time in its status bar.
    @ViewBuilder
    private var header: some View {
        #if os(tvOS)
        HStack(alignment: .firstTextBaseline) {
            Text("app.title")
                .font(.system(size: .tv(46), weight: .bold))
            Spacer()
            stale
            ClockLabel()
        }
        #else
        stale
        #endif
    }

    @ViewBuilder
    private var stale: some View {
        if let board = store.board, board.isStale {
            Label("home.stale", systemImage: "exclamationmark.triangle")
                .font(.callout)
                .foregroundStyle(.orange)
        }
    }

    @ViewBuilder
    private var content: some View {
        if let board = store.board {
            // The followed sides' games first, under "★ My Teams ›", as Apple
            // Sports opens its Home (Julien, 2026-11-15); found in every
            // competition, hidden ones too: a team followed is wanted. Each
            // is there once: not again under its competition (Julien,
            // 2026-11-16), which is left out when nothing else of it remains.
            let dayGroups = board.groups(for: day)
            let followed = favourites.games(in: dayGroups)
            let groups = Self.arranged(dayGroups, leagues: board.leagues)
                .without(Set(followed.map(\.event.id)))
            if groups.isEmpty, followed.isEmpty {
                EmptyDay(day: day)
            } else {
                LazyVStack(alignment: .leading, spacing: Metrics.sectionGap) {
                    if !followed.isEmpty {
                        FollowedSection(games: followed, day: day, now: board.generatedAt, openMyTeams: openMyTeams)
                    }
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
                .padding(.top, .tv(4))
            }
        } else if let error = store.error {
            VStack(spacing: .tv(12)) {
                Text("home.error").font(.title3)
                Text(error).font(.callout).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: .tv(500))
        } else {
            ProgressView("home.loading")
                .frame(maxWidth: .infinity, minHeight: .tv(500))
        }
    }

}

#Preview {
    #if os(tvOS)
    Sidebar(store: ScoreboardStore())
    #else
    SplitMenu(store: ScoreboardStore())
    #endif
}

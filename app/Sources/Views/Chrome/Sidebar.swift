import SwiftUI

/// The app's navigation: Home, then every competition we follow.
///
/// tvOS draws this as the floating sidebar — collapsed to the current entry
/// until focus moves left, where it opens over the page. It is a `TabView`
/// wearing `.sidebarAdaptable`, which is the system's own component rather
/// than a menu of our invention, so the focus behaviour comes for free.
///
/// It exists because the day buckets only carry competitions that have
/// fixtures: Formula 1 races every other weekend, so its page — and its
/// championship table — were unreachable for eleven days at a time.
struct Sidebar: View {
    @State private var store = ScoreboardStore()
    @State private var selection = Selection.home
    @State private var day: Day = Self.initialDay()

    enum Selection: Hashable {
        case home
        case league(String)
    }

    var body: some View {
        Group {
            if store.ready { tabs } else { LaunchLoader() }
        }
        .task { store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        .onChange(of: store.board?.leagues.count ?? 0) { _, _ in openRequestedLeague() }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            Tab(value: Selection.home) {
                HomeScreen(store: store, day: $day)
            } label: {
                Label("tab.home", systemImage: "house")
            }

            ForEach(leagues) { league in
                Tab(value: Selection.league(key(league))) {
                    LeaguePage(league: league, store: store, day: day)
                } label: {
                    SidebarRow(league: league)
                }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }

    private var leagues: [LeagueSummary] { store.board?.leagues ?? [] }

    private func key(_ league: LeagueSummary) -> String { "\(league.sport):\(league.id.raw)" }

    /// `-TVScoresLeague f1` opens that competition (CI screenshots).
    private func openRequestedLeague() {
        guard let wanted = Self.argument("-TVScoresLeague"),
              let hit = (store.board?.leagues ?? []).first(where: { $0.sport == wanted || $0.id.raw == wanted })
        else { return }
        selection = .league(key(hit))
    }

    private static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
        return nil
    }

    /// `-TVScoresTab upcoming` picks the initial day (used by CI screenshots).
    private static func initialDay() -> Day {
        guard let raw = argument("-TVScoresTab"), let day = Day(rawValue: raw) else { return .today }
        return day
    }
}

/// One competition's page, with its own navigation so a race opened from it
/// comes back to it rather than to Home.
private struct LeaguePage: View {
    let league: LeagueSummary
    let store: ScoreboardStore
    let day: Day

    var body: some View {
        NavigationStack {
            LeagueScreen(ref: LeagueRef(league), store: store, day: day)
                .navigationDestination(for: Event.self) { event in
                    RaceScreen(eventId: event.id, fallback: event, store: store)
                }
        }
    }
}

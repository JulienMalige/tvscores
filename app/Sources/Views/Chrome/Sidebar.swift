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
    /// The day a competition's page was opened on from the front page, so
    /// Yesterday's La Liga header opens Yesterday's La Liga.
    @State private var leagueDays: [String: Day] = [:]

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
        .onChange(of: store.leagues.count) { _, _ in openRequestedLeague() }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            Tab(value: Selection.home) {
                HomeScreen(store: store, day: $day, openLeague: open)
            } label: {
                Label("tab.home", systemImage: "house")
            }

            // One section per family of sport, the way the Apple TV app groups
            // its channels: a heading over each, and the competitions under it.
            ForEach(Self.sections, id: \.id) { section in
                let mine = leagues.filter { section.sports.contains($0.sport) }
                if !mine.isEmpty {
                    TabSection(section.title) {
                        // `day` is deliberately not passed from the binding: a
                        // league page takes it once, at creation, and reading
                        // the live value here would rebuild every tab in the
                        // menu each time the day switch is used. A page opened
                        // from the front page takes that day instead, and is
                        // made afresh for it.
                        ForEach(mine) { league in
                            Tab(value: Selection.league(key(league))) {
                                LeaguePage(league: league, store: store, day: leagueDays[key(league)] ?? Self.initialDay())
                                    .id(leagueDays[key(league)])
                            } label: {
                                // The version is what makes a row look at the
                                // cache again once its icon has arrived; the
                                // rows hold no state.
                                SidebarRow(league: league, iconsVersion: store.iconsVersion)
                            }
                        }
                    }
                }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
        // The slot at the top of the sidebar, where the Apple TV app shows
        // its profile and the time. Every app draws its own header here —
        // Disney+ and the like put their own account's profile in it — and
        // we have no profiles, so ours carries the name and the time.
        .tabViewSidebarHeader {
            HStack {
                Text("app.title")
                    .font(.title3.weight(.semibold))
                Spacer()
                ClockLabel(showsDate: false)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 24)
        }
    }

    /// The menu's sections, in order. A sport not named here is not shown.
    private static let sections: [(id: String, title: LocalizedStringKey, sports: [String])] = [
        ("football", "sidebar.football", ["football"]),
        ("motorsport", "sidebar.motorsport", ["f1", "motogp"]),
        ("us", "sidebar.us", ["nfl", "nba"]),
        ("tennis", "sidebar.tennis", ["tennis"]),
    ]

    private var leagues: [LeagueSummary] { store.leagues }

    private func key(_ league: LeagueSummary) -> String { "\(league.sport):\(league.id.raw)" }

    /// A competition opened from the front page: its own tab, on the day the
    /// front page was showing.
    private func open(_ ref: LeagueRef) {
        let key = "\(ref.sport):\(ref.leagueId)"
        guard leagues.contains(where: { self.key($0) == key }) else { return }
        leagueDays[key] = day
        selection = .league(key)
    }

    /// `-TVScoresLeague f1` opens that competition (CI screenshots).
    private func openRequestedLeague() {
        guard let wanted = Self.argument("-TVScoresLeague"),
              let hit = store.leagues.first(where: { $0.sport == wanted || $0.id.raw == wanted })
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

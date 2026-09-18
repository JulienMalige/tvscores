import SwiftUI

/// The app's navigation: the three days, then every competition we follow.
///
/// tvOS draws this as the tab bar along the top — the system's own component,
/// shown when focus moves up and tucked away while you read. Four entries,
/// which is what that bar was made for; the sidebar it replaced had sixteen,
/// and tvOS 18's sidebar is documented to lose its focus past seven.
///
/// The Competitions tab exists because the day buckets only carry what has
/// fixtures: Formula 1 races every other weekend, and its page — and its
/// championship table — must be reachable in between.
struct TopTabs: View {
    @State private var store = ScoreboardStore()
    @State private var page: Page = Self.initialPage()

    enum Page: Hashable {
        case day(Day)
        case competitions
    }

    var body: some View {
        Group {
            if store.ready { tabs } else { LaunchLoader() }
        }
        .task { store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
    }

    private var tabs: some View {
        TabView(selection: $page) {
            ForEach(Day.allCases) { day in
                Tab(title(day), value: Page.day(day)) {
                    DayScreen(store: store, day: day)
                }
            }
            Tab("tab.competitions", value: Page.competitions) {
                CompetitionsScreen(store: store, day: Self.initialDay())
            }
        }
        .tabViewStyle(.tabBarOnly)
    }

    private func title(_ day: Day) -> LocalizedStringKey {
        switch day {
        case .yesterday: "tab.yesterday"
        case .today: "tab.today"
        case .upcoming: "tab.upcoming"
        }
    }

    /// `-TVScoresTab upcoming` starts on that day; `-TVScoresLeague f1` starts
    /// on Competitions, which then opens that competition (CI screenshots).
    private static func initialPage() -> Page {
        if argument("-TVScoresLeague") != nil || argument("-TVScoresTab") == "competitions" { return .competitions }
        return .day(initialDay())
    }

    /// The day a competition's page opens on, from the same argument.
    private static func initialDay() -> Day {
        guard let raw = argument("-TVScoresTab"), let day = Day(rawValue: raw) else { return .today }
        return day
    }

    private static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
        return nil
    }
}

extension View {
    /// What a tab's stack can push: a competition's page, and a race's.
    func tabDestinations(store: ScoreboardStore, day: Day) -> some View {
        self
            .navigationDestination(for: LeagueRef.self) { LeagueScreen(ref: $0, store: store, day: day) }
            .navigationDestination(for: Event.self) { RaceScreen(eventId: $0.id, fallback: $0, store: store) }
    }
}

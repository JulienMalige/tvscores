import SwiftUI

/// The app's navigation: Home, then one entry per family of sport.
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
    @State private var choices = SportChoices(initialDay: Self.initialDay())

    enum Selection: Hashable {
        case home
        case sport(String)
    }

    var body: some View {
        Group {
            if store.ready { tabs } else { LaunchLoader(error: store.error) }
        }
        .task { Diagnostics.shared.start(); store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        .onChange(of: selection) { old, new in Diagnostics.shared.note("menu \(old) -> \(new)") }
        .onChange(of: store.iconsVersion) { _, v in Diagnostics.shared.note("icons version \(v)") }
        .onChange(of: store.leagues.count) { _, n in
            Diagnostics.shared.note("menu rebuilt: \(n) competitions")
            openRequestedLeague()
        }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            // The first row is Home. tvOS's sidebar has no header slot of
            // its own (`tabViewSidebarHeader` is not on tvOS).
            Tab(value: Selection.home) {
                HomeScreen(store: store, day: $day, openLeague: open)
            } label: {
                SidebarHeader()
            }
            // One row per family of sport, never one per competition: past
            // seven tabs tvOS's sidebar loses focus (see SportScreen).
            ForEach(SportSection.all) { section in
                let mine = store.leagues.filter { section.sports.contains($0.sport) }
                if !mine.isEmpty {
                    Tab(value: Selection.sport(section.id)) {
                        SportPage(section: section, leagues: mine, store: store, choices: choices)
                    } label: {
                        Label(section.title, systemImage: section.symbol)
                            .accessibilityIdentifier("tab.\(section.id)")
                    }
                }
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }

    /// A competition opened from the front page: its sport's tab, on that
    /// competition and on the day the front page was showing.
    private func open(_ ref: LeagueRef) {
        guard let section = SportSection.of(sport: ref.sport) else { return }
        choices.setCompetition(SportChoices.key(sport: ref.sport, id: ref.leagueId), for: section.id)
        choices.setDay(day, for: section.id)
        selection = .sport(section.id)
    }

    /// `-TVScoresLeague f1` opens that competition (CI screenshots).
    private func openRequestedLeague() {
        guard let wanted = Self.argument("-TVScoresLeague"),
              let hit = store.leagues.first(where: { $0.sport == wanted || $0.id.raw == wanted }),
              let section = SportSection.of(sport: hit.sport)
        else { return }
        choices.setCompetition(SportChoices.key(sport: hit.sport, id: hit.id.raw), for: section.id)
        selection = .sport(section.id)
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

/// One family of sport's page, with its own navigation so a race opened
/// from it comes back to it rather than to Home.
private struct SportPage: View {
    let section: SportSection
    let leagues: [LeagueSummary]
    let store: ScoreboardStore
    let choices: SportChoices

    var body: some View {
        NavigationStack {
            SportScreen(section: section, leagues: leagues, store: store, choices: choices)
                .navigationDestination(for: Event.self) { event in
                    RaceScreen(eventId: event.id, fallback: event, store: store)
                }
        }
    }
}

#if os(iOS)
import SwiftUI
import UIKit

/// The app's navigation on an iPhone or an iPad: the television's menu as
/// the system's split view (Julien, 2026-11-12). Its list is the menu —
/// Home, then each family of sport with its competitions, the gear at the
/// top — and the page it picks stands beside it on an iPad. On an iPhone the
/// page comes first and the list is one step back, as the menu is one press
/// left on the television. A competition opened from the front page is
/// pushed over it, the way a phone goes deeper; a game or a race rises on a
/// sheet.
struct SplitMenu: View {
    /// Owned by the app, not by this view: a new language rebuilds the screens
    /// and must not take the board and its pictures with them.
    let store: ScoreboardStore
    @State private var selection: MenuItem? = .home
    /// The column a phone shows: the page, until Back leads to the list.
    @State private var column = NavigationSplitViewColumn.detail
    /// Competitions opened from the front page, over it.
    @State private var opened: [MenuItem] = []
    @State private var day: Day = LaunchRequest.initialDay()
    /// The day a competition was opened on from the front page, so
    /// Yesterday's La Liga header opens Yesterday's La Liga.
    @State private var leagueDays: [String: Day] = [:]
    /// The game or race whose page is up, over the page it was opened from.
    @State private var game: Event?
    @State private var settingsOpen = false
    @State private var homeOpenedRace = false

    var body: some View {
        Group {
            if store.ready { split } else { LaunchLoader(progress: store.launchProgress, error: store.error) }
        }
        .task { store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        // The pictures the system emptied while the app was away come back.
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            Task { await store.rewarm() }
        }
        .onChange(of: store.leagues.count) { _, _ in
            openRequested()
            // A competition gone from the list leaves nothing to show: back to Home.
            if case .league(let key) = selection, league(key) == nil { selection = .home }
        }
        // A new row of the menu is a new page, with nothing pushed over it.
        .onChange(of: selection) { _, _ in opened = [] }
    }

    private var split: some View {
        NavigationSplitView(preferredCompactColumn: $column) {
            menu
        } detail: {
            NavigationStack(path: $opened) {
                page(selection ?? .home)
                    .navigationDestination(for: MenuItem.self) { page($0) }
            }
        }
        .sheet(item: $game) { event in
            if event.kind == .race {
                RaceScreen(eventId: event.id, fallback: event, store: store)
            } else {
                GameScreen(eventId: event.id, fallback: event, store: store)
            }
        }
        .sheet(isPresented: $settingsOpen) { SettingsScreen(leagues: store.leagues, apps: store.board?.apps ?? [:]) }
        // Outside the sheets, so the pages on them read the same.
        .environment(\.openGame) { game = $0 }
        .environment(\.boardNow, store.board?.generatedAt)
        .environment(\.watchApps, store.board?.apps)
        // A competition hidden in Settings while its page was up: back to Home.
        .onChange(of: LeagueChoice.shared.hidden) { _, hidden in
            if case .league(let key) = selection, hidden.contains(key) { selection = .home }
        }
        .task {
            // `-TVScoresMenuOpen` shows the list, `-TVScoresSettings` the
            // settings (CI screenshots).
            try? await Task.sleep(for: .seconds(1.5))
            // A phone shows the list when nothing in it is chosen.
            if LaunchRequest.argument("-TVScoresMenuOpen") != nil { selection = nil; column = .sidebar }
            if LaunchRequest.argument("-TVScoresSettings") != nil { settingsOpen = true }
        }
    }

    /// Home, then each family of sport with its competitions, as on the
    /// television; the gear at the top.
    private var menu: some View {
        List(selection: $selection) {
            Label { Text("tab.home") } icon: { MenuIcon.symbol("house.fill").view(size: Metrics.menuIcon) }
                .tag(MenuItem.home)
                .accessibilityIdentifier("menu.home")
            ForEach(SportSection.grouped(store.leagues), id: \.section.id) { entry in
                Section {
                    ForEach(entry.leagues) { league in
                        Label { Text(verbatim: league.menu) } icon: { MenuIcon.league(league).view(size: Metrics.menuIcon) }
                            .tag(MenuItem.league(MenuItem.key(league)))
                            .accessibilityIdentifier("menu.\(league.sport).\(league.id.raw)")
                    }
                } header: {
                    Text(entry.section.title)
                }
            }
        }
        .navigationTitle(Text("menu.title"))
        .toolbar {
            Button { settingsOpen = true } label: { Image(systemName: "gearshape") }
                .accessibilityIdentifier("menu.settings")
                .accessibilityLabel(Text("settings.title"))
        }
    }

    @ViewBuilder
    private func page(_ item: MenuItem) -> some View {
        switch item {
        case .home:
            HomeScreen(store: store, day: $day, openLeague: open, openedInitialRace: $homeOpenedRace)
        case .league(let key):
            if let league = league(key) {
                CompetitionScreen(ref: LeagueRef(league), store: store, day: leagueDays[key] ?? LaunchRequest.initialDay())
                    // Made afresh for a day picked on the front page.
                    .id("\(key)|\(leagueDays[key].map { "\($0)" } ?? "")")
            }
        case .settings:
            EmptyView() // never a page: the gear opens the sheet
        }
    }

    private func league(_ key: String) -> LeagueSummary? {
        store.leagues.first { MenuItem.key($0) == key }
    }

    /// A competition opened from the front page: pushed over it, on the day
    /// the front page was showing.
    private func open(_ ref: LeagueRef) {
        let key = "\(ref.sport):\(ref.leagueId)"
        guard league(key) != nil, LeagueChoice.shared.isShown(key) else { return }
        leagueDays[key] = day
        opened.append(.league(key))
    }

    /// `-TVScoresLeague f1` opens that competition, `-TVScoresGame final`
    /// the first game in that state (CI screenshots).
    private func openRequested() {
        if let wanted = LaunchRequest.argument("-TVScoresLeague"),
           let hit = store.leagues.first(where: { $0.sport == wanted || $0.id.raw == wanted }) {
            selection = .league(MenuItem.key(hit))
        }
        if let wanted = LaunchRequest.argument("-TVScoresGame"), let board = store.board {
            game = LaunchRequest.game(wanted, in: board)
        }
    }
}
#endif

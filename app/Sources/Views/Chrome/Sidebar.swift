import SwiftUI
import UIKit

/// The app's navigation: a menu of ours on the left, and the page it picks.
///
/// Ours rather than tvOS's sidebar (`TabView` with `.sidebarAdaptable`),
/// decided by Julien on 2026-09-28: tvOS's loses focus past seven tabs, so
/// with Home and fifteen competitions the menu opened and shut in one
/// movement from its lower rows — in the television's trace (build 24), and
/// still Apple's known issue on tvOS 26.6 (forum thread 769884). This one is
/// drawn after it: a chip at the top left saying where you are; a press
/// left that finds nothing further left on the page, or Back, opens a panel over the dimmed page with the
/// focus on the current row; right closes it, a click opens the row, and Back
/// in it leaves the app, as from tvOS's own.
///
/// It exists at all because the day buckets only carry competitions that
/// have fixtures: Formula 1 races every other weekend, so its page — and
/// its championship table — were unreachable for eleven days at a time.
struct Sidebar: View {
    @State private var store = ScoreboardStore()
    @State private var selection = MenuItem.home
    @State private var day: Day = Self.initialDay()
    /// The day a competition's page was opened on from the front page, so
    /// Yesterday's La Liga header opens Yesterday's La Liga.
    @State private var leagueDays: [String: Day] = [:]
    @State private var homePath = NavigationPath()
    /// The game whose page is up, over whatever page it was opened from.
    @State private var game: Event?
    @State private var homeOpenedRace = false
    @State private var expanded = false
    /// Set while the menu opens or shuts, when focus moves under our feet.
    @State private var moving = false
    /// The page under the chip is scrolled down: the chip shows its icon only.
    @State private var chipShrunk = false
    @FocusState private var menuFocus: MenuItem?

    var body: some View {
        Group {
            if store.ready { root } else { LaunchLoader(error: store.error) }
        }
        .task { Diagnostics.shared.start(); store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        .onChange(of: selection) { old, new in
            Diagnostics.shared.note("menu \(old) -> \(new)")
            chipShrunk = false
        }
        .onChange(of: expanded) { _, open in Diagnostics.shared.note("menu \(open ? "opened" : "shut")") }
        .onChange(of: store.iconsVersion) { _, v in Diagnostics.shared.note("icons version \(v)") }
        .onChange(of: store.leagues.count) { _, n in
            Diagnostics.shared.note("menu rebuilt: \(n) competitions")
            openRequestedLeague()
            openRequestedGame()
            // A competition gone from the list leaves nothing to show and
            // nothing for the remote to stand on: back to Home.
            if case .league(let key) = selection, !store.leagues.contains(where: { Self.key($0) == key }) {
                selection = .home
            }
        }
    }

    private var root: some View {
        ZStack(alignment: .topLeading) {
            page
                .environment(\.openMenu, openMenu)
                .environment(\.openGame) { game = $0 }
                .environment(\.menuIsOpen) { expanded }
                .environment(\.pageScrolled) { scrolled in
                    if scrolled != chipShrunk { chipShrunk = scrolled }
                }
            if expanded {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
            MenuPanel(sections: sections, selection: selection, expanded: expanded,
                      focus: $menuFocus, pick: pick, shrunk: chipShrunk)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: expanded)
        .fullScreenCover(item: $game) { event in
            GameScreen(eventId: event.id, fallback: event, store: store)
        }
        .onChange(of: menuFocus) { _, focused in
            // Focus gone from every row — a press right onto the page.
            if focused == nil, expanded, !moving { shut() }
        }
        .task {
            // A press left with nothing further left on the page is what
            // opens the menu: the focus engine reports a move that went
            // nowhere, and which way it was headed. An invisible strip along
            // the edge for focus to land on was tried first; the focus
            // engine would not take it (CI, 2026-09-28).
            // The same notice shuts it: a press right from a row with
            // nothing beside it on the page (Home, at the top) goes nowhere,
            // and tvOS's own sidebar shuts on any press right.
            for await note in NotificationCenter.default.notifications(named: UIFocusSystem.movementDidFailNotification) {
                // A game's page over everything owns the remote: a press left
                // on it is not the page underneath asking for the menu (build 28).
                guard let context = note.userInfo?[UIFocusSystem.focusUpdateContextUserInfoKey] as? UIFocusUpdateContext,
                      !moving, game == nil else { continue }
                if context.focusHeading.contains(.left), !expanded { openMenu() }
                if context.focusHeading.contains(.right), expanded { shut() }
            }
        }
        .task {
            try? await Task.sleep(for: .seconds(1.5))
            if Self.argument("-TVScoresMenuOpen") != nil { openMenu() }
        }
    }

    @ViewBuilder
    private var page: some View {
        switch selection {
        case .home:
            // Its navigation is held here, not in the screen: the screen is
            // made afresh each time Home is picked, and a race opened on it
            // should still be open when you come back.
            HomeScreen(store: store, day: $day, openLeague: open, path: $homePath, openedInitialRace: $homeOpenedRace)
        case .league(let key):
            if let league = store.leagues.first(where: { Self.key($0) == key }) {
                NavigationStack {
                    CompetitionScreen(ref: LeagueRef(league), store: store, day: leagueDays[key] ?? Self.initialDay())
                        .navigationDestination(for: Event.self) { event in
                            RaceScreen(eventId: event.id, fallback: event, store: store)
                        }
                }
                // Made afresh for a day picked on the front page.
                .id("\(key)|\(leagueDays[key].map { "\($0)" } ?? "")")
            }
        }
    }

    private var sections: [(section: SportSection, leagues: [LeagueSummary])] {
        SportSection.all.compactMap { section in
            // A league naming its own section goes there, not in its sport's.
            let mine = store.leagues.filter { $0.section.map { $0 == section.id } ?? section.sports.contains($0.sport) }
            return mine.isEmpty ? nil : (section, mine)
        }
    }

    // MARK: Opening and shutting

    private func openMenu() {
        guard !expanded else { return }
        moving = true
        expanded = true
        Task { @MainActor in
            // The rows exist from the next frame; focus can be put there then.
            try? await Task.sleep(for: .milliseconds(60))
            menuFocus = selection
            try? await Task.sleep(for: .milliseconds(300))
            moving = false
        }
    }

    private func shut() {
        moving = true
        expanded = false
        menuFocus = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(400))
            moving = false
        }
    }

    private func pick(_ item: MenuItem) {
        selection = item
        shut()
    }

    /// A competition opened from the front page: its own row, on the day the
    /// front page was showing.
    private func open(_ ref: LeagueRef) {
        let key = "\(ref.sport):\(ref.leagueId)"
        guard store.leagues.contains(where: { Self.key($0) == key }) else { return }
        leagueDays[key] = day
        selection = .league(key)
    }

    /// `-TVScoresLeague f1` opens that competition (CI screenshots).
    private func openRequestedLeague() {
        guard let wanted = Self.argument("-TVScoresLeague"),
              let hit = store.leagues.first(where: { $0.sport == wanted || $0.id.raw == wanted })
        else { return }
        selection = .league(Self.key(hit))
    }

    /// `-TVScoresGame final` opens the first game in that state (CI screenshots).
    private func openRequestedGame() {
        // "final" or "final:football" — a state, and the sport to take it from.
        guard let wanted = Self.argument("-TVScoresGame"), let board = store.board else { return }
        let parts = wanted.split(separator: ":").map(String.init)
        game = Day.allCases.flatMap { board.groups(for: $0) }.flatMap(\.events)
            .first { $0.kind == .match && $0.status.state.rawValue == parts.first
                && (parts.count < 2 || $0.sport == parts[1]) }
    }

    static func key(_ league: LeagueSummary) -> String { "\(league.sport):\(league.id.raw)" }

    private static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
        return args.contains(name) ? "" : nil
    }

    /// `-TVScoresTab upcoming` picks the initial day (used by CI screenshots).
    private static func initialDay() -> Day {
        guard let raw = argument("-TVScoresTab"), let day = Day(rawValue: raw) else { return .today }
        return day
    }
}

/// A row of the menu.
enum MenuItem: Hashable {
    case home
    case league(String)
}

extension EnvironmentValues {
    /// Opens the menu; a page calls it on Back, as tvOS's sidebar does.
    @Entry var openMenu: @MainActor () -> Void = {}
    /// Opens a game's page, from its row.
    @Entry var openGame: @MainActor (Event) -> Void = { _ in }
    /// A page reports whether it is scrolled away from its top, for the menu
    /// chip to shrink to its icon, as tvOS's own does.
    @Entry var pageScrolled: @MainActor (Bool) -> Void = { _ in }
    /// Whether the menu is open, read when asked, not when the view was made.
    @Entry var menuIsOpen: @MainActor () -> Bool = { false }
}

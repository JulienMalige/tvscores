import SwiftUI

/// The app's navigation: a menu of ours on the left, and the page it picks.
///
/// Ours rather than tvOS's sidebar (`TabView` with `.sidebarAdaptable`),
/// decided by Julien on 2026-09-28: tvOS's loses focus past seven tabs, so
/// with Home and fifteen competitions the menu opened and shut in one
/// movement from its lower rows — in the television's trace (build 24), and
/// still Apple's known issue on tvOS 26.6 (forum thread 769884). This one is
/// drawn after it: a chip at the top left saying where you are; a press
/// left from the page, or Back, opens a panel over the dimmed page with the
/// focus on the current row; right or Back closes it, a click opens the row.
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
    @State private var expanded = false
    /// Off while the menu opens or shuts, and for a moment after launch:
    /// the strip is the leftmost thing on screen, and the focus engine,
    /// choosing where to start, would otherwise start there.
    @State private var openerArmed = false
    @FocusState private var menuFocus: MenuItem?
    @FocusState private var openerFocused: Bool

    var body: some View {
        Group {
            if store.ready { root } else { LaunchLoader(error: store.error) }
        }
        .task { Diagnostics.shared.start(); store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        .onChange(of: selection) { old, new in Diagnostics.shared.note("menu \(old) -> \(new)") }
        .onChange(of: expanded) { _, open in Diagnostics.shared.note("menu \(open ? "opened" : "shut")") }
        .onChange(of: store.iconsVersion) { _, v in Diagnostics.shared.note("icons version \(v)") }
        .onChange(of: store.leagues.count) { _, n in
            Diagnostics.shared.note("menu rebuilt: \(n) competitions")
            openRequestedLeague()
        }
    }

    private var root: some View {
        ZStack(alignment: .topLeading) {
            page
                .environment(\.openMenu, openMenu)
            if expanded {
                Color.black.opacity(0.45)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .transition(.opacity)
            }
            if !expanded {
                // What a press left lands on: a strip down the whole left
                // edge, so it is in the way of a press from any row.
                Color.white.opacity(0.02)
                    .frame(width: Metrics.menuOpener)
                    .frame(maxHeight: .infinity)
                    .ignoresSafeArea()
                    .focusable(openerArmed)
                    .focused($openerFocused)
                    .accessibilityIdentifier("menu.opener")
            }
            MenuPanel(sections: sections, selection: selection, expanded: expanded,
                      focus: $menuFocus, pick: pick, close: closeMenu)
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.86), value: expanded)
        .onChange(of: openerFocused) { _, focused in if focused { openMenu() } }
        .onChange(of: menuFocus) { _, focused in
            // Focus gone from every row — a press right onto the page.
            if focused == nil, expanded, openerArmed { shut() }
        }
        .task {
            try? await Task.sleep(for: .seconds(1.5))
            openerArmed = true
            if Self.argument("-TVScoresMenuOpen") != nil { openMenu() }
        }
    }

    @ViewBuilder
    private var page: some View {
        switch selection {
        case .home:
            HomeScreen(store: store, day: $day, openLeague: open)
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
            let mine = store.leagues.filter { section.sports.contains($0.sport) }
            return mine.isEmpty ? nil : (section, mine)
        }
    }

    // MARK: Opening and shutting

    private func openMenu() {
        guard !expanded else { return }
        openerArmed = false
        expanded = true
        Task { @MainActor in
            // The rows exist from the next frame; focus can be put there then.
            try? await Task.sleep(for: .milliseconds(60))
            menuFocus = selection
            try? await Task.sleep(for: .milliseconds(300))
            openerArmed = true
        }
    }

    private func shut() {
        openerArmed = false
        expanded = false
        menuFocus = nil
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(800))
            openerArmed = true
        }
    }

    private func closeMenu() { shut() }

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
}

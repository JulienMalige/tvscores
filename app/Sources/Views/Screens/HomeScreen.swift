import SwiftUI

/// The app's front page: one day of every league the proxy follows.
struct HomeScreen: View {
    @State private var store = ScoreboardStore()
    @State private var day: Day = Self.initialDay()
    @State private var path = NavigationPath()
    @State private var openedInitialLeague = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                // Title and tabs scroll away with the list. On a television a
                // pinned bar saves no input, since reaching the tabs means
                // moving focus up there anyway, and the focus engine brings
                // them back on screen when it does.
                VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                    header
                    DayTabs(selected: $day)
                    content
                }
                .padding(.horizontal, Metrics.screenMargin)
                .padding(.top, Metrics.screenTop)
                .padding(.bottom, Metrics.screenBottom)
            }
            .navigationDestination(for: LeagueRef.self) { ref in
                LeagueScreen(ref: ref, store: store, day: day)
            }
            .navigationDestination(for: Event.self) { RaceScreen(eventId: $0.id, fallback: $0, store: store) }
        }
        .task { store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
        .onChange(of: store.board == nil) { _, isNil in
            // `-TVScoresLeague f1` opens that league page once data exists (CI screenshots).
            guard !isNil, !openedInitialLeague, let board = store.board else { return }
            let all = Day.allCases.flatMap { board.groups(for: $0) }
            if let wanted = Self.initialRace() {
                let race = all.filter { $0.sport == wanted }
                    .flatMap(\.events)
                    .first { !($0.results ?? []).isEmpty }
                guard let race else { return }
                var next = NavigationPath()
                next.append(race)
                path = next
                openedInitialLeague = true
            } else if let wanted = Self.initialLeague(), let g = all.first(where: { $0.sport == wanted }) {
                var next = NavigationPath()
                next.append(LeagueRef(group: g))
                path = next
                openedInitialLeague = true
            }
        }
    }

    private static func initialLeague() -> String? { argument("-TVScoresLeague") }

    /// `-TVScoresRace f1` opens that series' latest classified race (CI screenshots).
    private static func initialRace() -> String? { argument("-TVScoresRace") }

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
            Text(Date.now, format: .dateTime.weekday(.wide).day().month(.wide))
                .font(.title3)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var content: some View {
        if let board = store.board {
            let groups = board.groups(for: day)
            if groups.isEmpty {
                EmptyDay()
            } else {
                LazyVStack(alignment: .leading, spacing: Metrics.sectionGap) {
                    ForEach(groups) { group in
                        LeagueSection(group: group, linkToLeague: true)
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

    /// `-TVScoresTab upcoming` picks the initial tab (used by CI screenshots).
    private static func initialDay() -> Day {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-TVScoresTab"), i + 1 < args.count, let d = Day(rawValue: args[i + 1]) { return d }
        return .today
    }
}

#Preview {
    HomeScreen()
}

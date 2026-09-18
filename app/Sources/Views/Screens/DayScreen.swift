import SwiftUI

/// One day of every league the proxy follows: a tab's page.
struct DayScreen: View {
    let store: ScoreboardStore
    let day: Day
    @State private var path = NavigationPath()
    @State private var openedInitialRace = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                // The title scrolls away with the list; the tab bar is the
                // system's and comes down on its own when focus moves up.
                VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                    header
                    content
                }
                .pageMargins()
            }
            .tabDestinations(store: store, day: day)
        }
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
        let race = Day.allCases.flatMap { board.groups(for: $0) }
            .filter { $0.sport == wanted }
            .flatMap(\.events)
            .first { !($0.results ?? []).isEmpty }
        guard let race else { return }
        var next = NavigationPath()
        next.append(race)
        path = next
        openedInitialRace = true
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
                .accessibilityIdentifier("page.\(day.rawValue)")
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

}


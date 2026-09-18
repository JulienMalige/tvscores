import SwiftUI

/// The app's front page: one day of every league the proxy follows.
struct HomeScreen: View {
    let store: ScoreboardStore
    @Binding var day: Day
    @State private var path = NavigationPath()
    @State private var openedInitialRace = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                // Title and day switch scroll away with the list. On a
                // television a pinned bar saves no input, since reaching them
                // means moving focus up there anyway, and the focus engine
                // brings them back on screen when it does.
                VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                    header
                    DayTabs(selected: $day)
                    content
                }
                .pageMargins()
            }
            .navigationDestination(for: LeagueRef.self) { ref in
                LeagueScreen(ref: ref, store: store, day: day)
            }
            .navigationDestination(for: Event.self) { RaceScreen(eventId: $0.id, fallback: $0, store: store) }
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

#Preview {
    Sidebar()
}

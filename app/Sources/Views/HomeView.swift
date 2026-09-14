import SwiftUI

struct HomeView: View {
    @State private var store = ScoreboardStore()
    @State private var day: Day = Self.initialDay()
    @State private var path = NavigationPath()
    @State private var openedInitialLeague = false

    var body: some View {
        NavigationStack(path: $path) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .safeAreaInset(edge: .top, spacing: 0) { headerBar }
                .navigationDestination(for: LeagueRef.self) { ref in
                    LeagueView(ref: ref, store: store, day: day)
                }
                .navigationDestination(for: Event.self) { RaceDetailView(eventId: $0.id, fallback: $0, store: store) }
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

    /// Title and tabs live in the top safe area, so the list scrolls underneath
    /// them instead of over them and the focus engine keeps rows clear of it.
    private var headerBar: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            DayTabs(selected: $day)
        }
        .padding(.horizontal, 80)
        .padding(.top, 44)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial)
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
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 48) {
                        ForEach(groups) { group in
                            LeagueSection(group: group, linkToLeague: true)
                        }
                    }
                    .padding(.horizontal, 80)
                    .padding(.top, 28)
                    .padding(.bottom, 80)
                }
            }
        } else if let error = store.error {
            VStack(spacing: 12) {
                Text("home.error").font(.title3)
                Text(error).font(.callout).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ProgressView("home.loading")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// `-TVScoresTab upcoming` picks the initial tab (used by CI screenshots).
    private static func initialDay() -> Day {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-TVScoresTab"), i + 1 < args.count, let d = Day(rawValue: args[i + 1]) { return d }
        return .today
    }
}

struct DayTabs: View {
    @Binding var selected: Day
    @FocusState private var focused: Day?

    var body: some View {
        HStack(spacing: 24) {
            ForEach(Day.allCases) { d in
                Button {
                    selected = d
                } label: {
                    Text(title(d))
                        .fontWeight(selected == d ? .bold : .regular)
                }
                .buttonStyle(.bordered)
                .focused($focused, equals: d)
            }
            Spacer()
        }
        .defaultFocus($focused, selected, priority: .userInitiated)
        .focusSection()
        .task {
            // The focus engine settles after the first layout pass, and inside a
            // safe-area inset that happens later than onAppear. Re-assert once so
            // the highlight starts on the selected day, not the leading tab.
            focused = selected
            await Task.yield()
            focused = selected
        }
    }

    private func title(_ d: Day) -> LocalizedStringKey {
        switch d {
        case .yesterday: "tab.yesterday"
        case .today: "tab.today"
        case .upcoming: "tab.upcoming"
        }
    }
}

struct EmptyDay: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "sportscourt")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("home.empty")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    HomeView()
}

import SwiftUI

struct HomeView: View {
    @State private var store = ScoreboardStore()
    @State private var day: Day = Self.initialDay()

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            header
            DayTabs(selected: $day)
            content
        }
        .padding(.horizontal, 80)
        .padding(.top, 60)
        .padding(.bottom, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .task { store.startAutoRefresh() }
        .onDisappear { store.stopAutoRefresh() }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("app.title")
                .font(.system(size: 56, weight: .bold))
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
                    LazyVStack(alignment: .leading, spacing: 36) {
                        ForEach(groups) { group in
                            LeagueSection(group: group)
                        }
                    }
                    .padding(.bottom, 60)
                }
                .scrollClipDisabled()
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

    var body: some View {
        HStack(spacing: 24) {
            ForEach(Day.allCases) { d in
                Button(title(d)) { selected = d }
                    .buttonStyle(.bordered)
                    .tint(selected == d ? .accentColor : .secondary)
            }
            Spacer()
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

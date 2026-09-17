import SwiftUI

/// One competition: the same three day tabs filtered to it, and its standings below.
struct LeagueScreen: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @State var day: Day

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                header
                DayTabs(selected: $day)
                games
                StandingsSection(ref: ref, store: store)
            }
            .padding(.horizontal, Metrics.screenMargin)
            .padding(.top, Metrics.screenTop)
            .padding(.bottom, Metrics.screenBottom)
        }
        .scrollClipDisabled()
    }

    private var header: some View {
        HStack(spacing: Metrics.headingGap) {
            LeagueMark(sport: ref.sport, logo: ref.logo)
            Text(ref.name)
                .font(.system(size: 48, weight: .bold))
            Spacer()
            ClockLabel()
        }
    }

    @ViewBuilder
    private var games: some View {
        let groups = (store.board?.groups(for: day) ?? []).filter { ref.matches($0) }
        if groups.isEmpty {
            Text("home.empty")
                .font(.title3)
                .foregroundStyle(.secondary)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        } else {
            ForEach(groups) { group in
                LeagueSection(group: group, showHeader: false)
            }
        }
    }
}

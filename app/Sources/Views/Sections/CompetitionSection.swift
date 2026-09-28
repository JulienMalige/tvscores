import SwiftUI

/// One competition under its page's heading: its day, its games, its table.
///
/// The day switch stays between seasons, as in Apple Sports: an empty day
/// says when the new season starts.
struct CompetitionSection: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @Binding var day: Day

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
            BoardCard(day: $day) { games }
            StandingsSection(ref: ref, store: store, carded: true)
        }
    }

    @ViewBuilder
    private var games: some View {
        let groups = (store.board?.groups(for: day) ?? []).filter { ref.matches($0) }
        if groups.isEmpty {
            if !ref.playing, let next = ref.next, let season = OffseasonSection.season(of: next, league: ref.name) {
                OffseasonSection(next: next, season: season)
            } else {
                EmptyDay(day: day)
            }
        } else {
            ForEach(groups) { group in
                LeagueSection(group: group, day: day, now: store.board?.generatedAt ?? .now, showHeader: false, onPage: true)
            }
        }
    }
}

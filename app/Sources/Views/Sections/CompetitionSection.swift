import SwiftUI

/// One competition under its page's heading: its day, its games, its table.
///
/// Between seasons there is no day to switch to, so the "coming up" card
/// stands in for the switch and the games; it takes focus, so the page is
/// never one the remote cannot leave.
struct CompetitionSection: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @Binding var day: Day

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
            if !ref.playing, let next = ref.next {
                OffseasonSection(ref: ref, next: next)
            } else {
                BoardCard(day: $day) { games }
            }
            StandingsSection(ref: ref, store: store, carded: true)
        }
    }

    @ViewBuilder
    private var games: some View {
        let groups = (store.board?.groups(for: day) ?? []).filter { ref.matches($0) }
        if groups.isEmpty {
            EmptyDay(compact: true)
        } else {
            ForEach(groups) { group in
                LeagueSection(group: group, day: day, now: store.board?.generatedAt ?? .now, showHeader: false, onPage: true)
            }
        }
    }
}

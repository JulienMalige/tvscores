import SwiftUI

/// One competition in the list of them: its mark, its name, and whether it
/// has anything on this week.
struct CompetitionRow: View {
    let league: LeagueSummary

    var body: some View {
        NavigationLink(value: LeagueRef(league)) {
            CompetitionRowContent(league: league)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("competition.\(league.sport).\(league.id.raw)")
    }
}

private struct CompetitionRowContent: View {
    let league: LeagueSummary
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 20) {
            // The square icon the proxy composes, so a wordmark and a crest
            // sit on one vertical line and no mark is larger than its neighbour.
            LeagueMark(sport: league.sport, logo: league.icon ?? league.logo, square: Metrics.mark)
            VStack(alignment: .leading, spacing: 2) {
                Text(league.name)
                    .font(.title3.weight(.semibold))
                if !league.playing {
                    Text("competitions.noGames")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.callout.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .rowSurface(focused: isFocused)
    }
}

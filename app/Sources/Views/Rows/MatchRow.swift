import SwiftUI

/// Apple Sports row shape: the crest with the name under it, the score
/// beside it, the status in the middle, and the same mirrored for the away
/// side. Stacked rather than side by side (Julien, 2026-09-19, from the
/// Apple Sports app: "the logo and the name on the bottom"): the crest is
/// what the eye reads from the sofa, and the name sits under it in small
/// type as a caption.
struct MatchRow: View {
    let event: Event

    var body: some View {
        Button {
            // Match detail comes later.
        } label: {
            MatchRowContent(event: event)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("match.\(event.id)")
    }
}

private struct MatchRowContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 0) {
            side(event.home)
            scoreText(event.score?.home, winner: winner == .home)
                .frame(width: Metrics.matchScore, alignment: .center)
            StatusLabel(status: event.status, start: event.start)
                .frame(maxWidth: .infinity)
            scoreText(event.score?.away, winner: winner == .away)
                .frame(width: Metrics.matchScore, alignment: .center)
            side(event.away)
        }
        .rowSurface(focused: isFocused)
    }

    private enum Winner { case home, away, nobody }

    private var winner: Winner {
        guard event.status.state == .final, let h = event.score?.home, let a = event.score?.away else { return .nobody }
        return h > a ? .home : a > h ? .away : .nobody
    }

    /// The crest, and the name under it as a caption, centred on the crest
    /// — the same column on either side of the row.
    @ViewBuilder
    private func side(_ team: TeamRef?) -> some View {
        VStack(spacing: Metrics.matchNameGap) {
            if let team {
                if team.logo == nil, team.flag != nil || team.photo != nil {
                    PersonMark(photo: team.photo, flag: team.flag, monogram: team.short)
                } else {
                    TeamMark(code: team.short, logo: team.logo)
                }
                Text(team.label)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .frame(width: Metrics.matchSide)
    }

    private func scoreText(_ value: Int?, winner: Bool) -> some View {
        Text(value.map { String($0) } ?? "–")
            .font(.system(size: 54, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(loser(winner) ? .secondary : .primary)
    }

    private func loser(_ isWinner: Bool) -> Bool {
        self.winner != .nobody && !isWinner
    }
}

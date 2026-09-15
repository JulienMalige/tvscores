import SwiftUI

/// Apple Sports row shape: mark · name | score | status | score | mark · name.
struct MatchRow: View {
    let event: Event

    var body: some View {
        Button {
            // Match detail comes later.
        } label: {
            MatchRowContent(event: event)
        }
        .buttonStyle(.plain)
    }
}

private struct MatchRowContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 0) {
            side(event.home, leading: true)
                .frame(width: 360, alignment: .leading)
            scoreText(event.score?.home, winner: winner == .home)
                .frame(width: 140, alignment: .trailing)
            StatusLabel(status: event.status, start: event.start)
                .frame(maxWidth: .infinity)
            scoreText(event.score?.away, winner: winner == .away)
                .frame(width: 140, alignment: .leading)
            side(event.away, leading: false)
                .frame(width: 360, alignment: .trailing)
        }
        .rowSurface(focused: isFocused)
    }

    private enum Winner { case home, away, nobody }

    private var winner: Winner {
        guard event.status.state == .final, let h = event.score?.home, let a = event.score?.away else { return .nobody }
        return h > a ? .home : a > h ? .away : .nobody
    }

    @ViewBuilder
    private func side(_ team: TeamRef?, leading: Bool) -> some View {
        if let team {
            HStack(spacing: 16) {
                if !leading { Text(team.label).font(.title3).lineLimit(1).minimumScaleFactor(0.7) }
                if team.logo == nil, team.flag != nil || team.photo != nil {
                    PersonMark(photo: team.photo, flag: team.flag, monogram: team.short)
                } else {
                    TeamMark(code: team.short, logo: team.logo)
                }
                if leading { Text(team.label).font(.title3).lineLimit(1).minimumScaleFactor(0.7) }
            }
        }
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

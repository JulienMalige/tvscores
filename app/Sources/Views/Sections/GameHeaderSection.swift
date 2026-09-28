import SwiftUI

/// The top of a game's page, after Apple Sports': the competition over it,
/// each side's mark large with its name and record under it, and the score
/// — or the kickoff — between them. The block takes focus, so a page with
/// nothing else on it still gives the remote a place to be.
struct GameHeaderSection: View {
    let event: Event
    let competition: String
    let records: GameDetail.Records?

    var body: some View {
        FocusBlock(identifier: "game.header") {
            VStack(spacing: 20) {
                Text(verbatim: competition)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
                HStack(alignment: .center, spacing: 0) {
                    side(event.home, record: records?.home)
                        .frame(maxWidth: .infinity)
                    centre
                        .frame(width: Metrics.gameCentre)
                    side(event.away, record: records?.away)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.vertical, 20)
        }
    }

    @ViewBuilder
    private func side(_ team: TeamRef?, record: String?) -> some View {
        VStack(spacing: 10) {
            if let team {
                if team.logo == nil, team.flag != nil || team.photo != nil {
                    PersonMark(photo: team.photo, flag: team.flag, monogram: team.short, size: Metrics.markHero)
                } else {
                    TeamMark(code: team.short, logo: team.logo, size: Metrics.markHero)
                }
                Text(team.label)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if let record {
                    Text(verbatim: record)
                        .font(.callout)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var centre: some View {
        VStack(spacing: 8) {
            if event.status.state == .scheduled {
                StatusLabel(status: event.status, start: event.start)
            } else {
                HStack(spacing: 28) {
                    score(event.score?.home, dim: loser == .home)
                    Text(verbatim: "–").font(.system(size: 60, weight: .bold)).foregroundStyle(.secondary)
                    score(event.score?.away, dim: loser == .away)
                }
                StatusLabel(status: event.status, start: event.start)
            }
        }
    }

    private enum Side { case home, away, none }

    private var loser: Side {
        guard event.status.state == .final, let h = event.score?.home, let a = event.score?.away, h != a else { return .none }
        return h < a ? .home : .away
    }

    private func score(_ value: Int?, dim: Bool) -> some View {
        Text(value.map(String.init) ?? "–")
            .font(.system(size: 96, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(dim ? .secondary : .primary)
    }
}

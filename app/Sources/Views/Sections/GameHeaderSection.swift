import SwiftUI

/// The top of a game's page, after Apple Sports': the competition over it,
/// each side's mark large with its name and record under it, and between
/// them the kickoff — or, once it is on, each side's score tall over its
/// mark with the state of the game in the middle. It sits on the page's
/// tint rather than a panel, and takes focus plainly, so a page with
/// nothing else on it still gives the remote a place to be.
struct GameHeaderSection: View {
    let event: Event
    let competition: String
    let records: GameDetail.Records?

    private var scored: Bool { event.status.state != .scheduled && event.score?.home != nil }

    var body: some View {
        FocusBlock(identifier: "game.header", surface: false) {
            VStack(spacing: 28) {
                Text(verbatim: competition)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Grid(horizontalSpacing: 0, verticalSpacing: 12) {
                    if scored {
                        GridRow {
                            score(event.score?.home, dim: loser == .home, side: 0)
                            status
                            score(event.score?.away, dim: loser == .away, side: 1)
                        }
                    }
                    GridRow {
                        mark(event.home)
                        if scored { empty } else { status }
                        mark(event.away)
                    }
                    GridRow {
                        name(event.home)
                        empty
                        name(event.away)
                    }
                    if let records {
                        GridRow {
                            record(records.home)
                            empty
                            record(records.away)
                        }
                    }
                }
            }
        }
    }

    private var status: some View {
        // Where it is on, under the time, as Apple Sports gives it: a page
        // that opens on a table keeps its Information block below the
        // screen, and the channel is what you came for (Julien, build 33).
        VStack(spacing: 8) {
            StatusLabel(status: event.status, start: event.start, setsShown: event.setScores != nil)
            if let channels = event.upcomingChannels { ChannelsLabel(channels: channels, limit: 3) }
        }
        .frame(width: Metrics.gameCentre)
    }

    private var empty: some View {
        Color.clear.gridCellUnsizedAxes([.horizontal, .vertical])
    }

    @ViewBuilder
    private func mark(_ team: TeamRef?) -> some View {
        Group {
            if let team {
                if team.logo == nil, team.flag != nil || team.photo != nil {
                    PersonMark(photo: team.photo, flag: team.flag, monogram: team.short, size: markSize)
                } else {
                    TeamMark(code: team.short, logo: team.logo, size: markSize)
                }
            }
        }
        .frame(width: Metrics.gameSide)
    }

    /// Smaller under a score, as Apple Sports draws it; larger on its own.
    private var markSize: CGFloat { scored ? Metrics.gameMark : Metrics.gameMark * 1.4 }

    private func name(_ team: TeamRef?) -> some View {
        Text(verbatim: team?.label ?? "")
            .font(.body.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: Metrics.gameSide)
    }

    private func record(_ value: String?) -> some View {
        Text(verbatim: value ?? "")
            .font(.caption.weight(.medium))
            .monospacedDigit()
            .foregroundStyle(.secondary)
    }

    private enum Side { case home, away, none }

    private var loser: Side {
        guard event.status.state == .final, let h = event.score?.home, let a = event.score?.away, h != a else { return .none }
        return h < a ? .home : .away
    }

    /// Tall and narrow, as a scoreboard's figures: the loser's greyed.
    @ViewBuilder
    private func score(_ value: Int?, dim: Bool, side: Int) -> some View {
        if let sets = event.setScores {
            SetScores(sets: sets, side: side, size: Metrics.gameSetScore, inPlay: event.status.state == .live)
        } else {
            Text(verbatim: value.map(String.init) ?? "–")
                .font(.system(size: Metrics.gameScore, weight: .bold).width(.condensed))
                .monospacedDigit()
                .foregroundStyle(dim ? Color.white.opacity(0.4) : .white)
        }
    }
}

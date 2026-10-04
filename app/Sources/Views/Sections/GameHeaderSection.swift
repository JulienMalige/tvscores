import SwiftUI

/// The top of a game's page, after Apple Sports': the competition over it,
/// each side's mark large with its name and record under it, and between
/// them the kickoff — or, once it is on, each side's score tall over its
/// mark with the state of the game in the middle. It sits on the page's
/// tint rather than a panel, and takes focus plainly, so a page with
/// nothing else on it still gives the remote a place to be.
///
/// A tennis match under way or over is Apple Sports' instead (Julien,
/// 2026-10-03): the two portraits and names either side of the state of
/// the match, and under them a table of the sets — their numbers on top,
/// then a line per player with each set's games in columns, as the list's
/// row draws them. Each player's games run together under a portrait read
/// "366" against "600".
struct GameHeaderSection: View {
    let event: Event
    let competition: String
    let records: GameDetail.Records?

    private var scored: Bool { event.status.state != .scheduled && event.score?.home != nil }

    var body: some View {
        FocusBlock(identifier: "game.header", surface: false) {
            VStack(spacing: 28) {
                Text(verbatim: caption)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if let sets = event.setScores {
                    players
                    setTable(sets)
                } else {
                    teams
                }
            }
        }
    }

    /// The competition, and for a tennis match its round, as the list's
    /// row captions it: "China Open · WTA 1000 · Round of 32".
    private var caption: String {
        guard event.sport == "tennis", let round = event.round else { return competition }
        return [competition, round].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var teams: some View {
        Grid(horizontalSpacing: 0, verticalSpacing: 12) {
            if scored {
                GridRow {
                    score(event.score?.home, dim: loser == .home)
                    status
                    score(event.score?.away, dim: loser == .away)
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

    /// Two portraits with their names, the state of the match between them.
    private var players: some View {
        Grid(horizontalSpacing: 0, verticalSpacing: 12) {
            GridRow {
                mark(event.home)
                status
                mark(event.away)
            }
            GridRow {
                name(event.home)
                empty
                name(event.away)
            }
        }
    }

    /// The sets' numbers over their columns, then a line per player: the
    /// name, greyed for the loser, and each set's games at the right.
    private func setTable(_ sets: [[Int]]) -> some View {
        VStack(spacing: Metrics.tennisLineGap) {
            HStack(spacing: 0) {
                Spacer(minLength: 0)
                ForEach(sets.indices, id: \.self) { i in
                    Text(verbatim: String(i + 1))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                        .frame(width: Metrics.tennisSetColumn)
                }
                Spacer().frame(width: Metrics.tennisArrow)
            }
            setLine(event.home, side: 0, sets: sets)
            setLine(event.away, side: 1, sets: sets)
        }
        .frame(width: Metrics.gameSetTable)
    }

    private func setLine(_ team: TeamRef?, side: Int, sets: [[Int]]) -> some View {
        let winner = event.tennisWinner
        return HStack(spacing: Metrics.tennisSetGap) {
            Text(verbatim: team.map(TennisRowContent.shortName) ?? "")
                .font(.callout.weight(.medium))
                .foregroundStyle(winner == nil || winner == side ? .primary : .secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
            SetGames(sets: sets, side: side, inPlay: event.status.state == .live, won: winner == side)
        }
    }

    private var status: some View {
        // Where it is on, under the time, as Apple Sports gives it: a page
        // that opens on a table keeps its Information block below the
        // screen, and the channel is what you came for (Julien, build 33).
        VStack(spacing: 8) {
            StatusLabel(status: event.status, start: event.start, setsShown: event.setScores != nil)
            if let channels = event.channelList { ChannelsLabel(channels: channels, limit: 3) }
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

    /// Smaller under a score, as Apple Sports draws it; larger on its own,
    /// and over a tennis match's set table, which has no score above it.
    private var markSize: CGFloat {
        scored && event.setScores == nil ? Metrics.gameMark : Metrics.gameMark * 1.4
    }

    private func name(_ team: TeamRef?) -> some View {
        Text(verbatim: displayName(team))
            .font(.body.weight(.semibold))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: Metrics.gameSide)
    }

    /// "K. Siniakova" under a player's portrait, as the tours print a draw.
    private func displayName(_ team: TeamRef?) -> String {
        guard let team else { return "" }
        return event.sport == "tennis" ? TennisRowContent.shortName(team) : team.label
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
    private func score(_ value: Int?, dim: Bool) -> some View {
        Text(verbatim: value.map(String.init) ?? "–")
            .font(.system(size: Metrics.gameScore, weight: .bold).width(.condensed))
            .monospacedDigit()
            .foregroundStyle(dim ? Color.white.opacity(0.4) : .white)
    }
}

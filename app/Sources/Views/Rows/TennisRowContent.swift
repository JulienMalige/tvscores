import SwiftUI

/// A tennis match as Apple Sports lists one (Julien, build 31): the
/// tournament and round centred in grey on top, then a line per player —
/// portrait with flag, "R. Zarazua", and each set's games at the right in
/// columns, the set's loser greyed and an arrow after the winner. Before it
/// starts, the time stands where the games will go; in play, the set.
struct TennisRowContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    private var sets: [[Int]] { event.setScores ?? [] }
    private var live: Bool { event.status.state == .live }

    /// The feed's word on who won, else sets won; nobody has won a match
    /// still in play.
    private var winner: Int? {
        guard event.status.state == .final else { return nil }
        switch event.score?.winner {
        case "home": return 0
        case "away": return 1
        default:
            guard let h = event.score?.home, let a = event.score?.away, h != a else { return nil }
            return h > a ? 0 : 1
        }
    }

    var body: some View {
        VStack(spacing: Metrics.tennisLineGap) {
            if let caption {
                Text(verbatim: caption)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            HStack(spacing: Metrics.tennisSetGap) {
                VStack(spacing: Metrics.tennisLineGap) {
                    player(event.home, side: 0)
                    player(event.away, side: 1)
                }
                // Over with no games known (a result from before build 32):
                // "Final" says it rather than nothing.
                if event.status.state != .final || sets.isEmpty {
                    VStack(spacing: 4) {
                        StatusLabel(status: event.status, start: event.start, compact: true,
                                    setsShown: !sets.isEmpty, sport: event.sport)
                            .fixedSize()
                        // Held to a width, so a long line shrinks or ends in
                        // "+1" rather than squeezing the players' names.
                        if let channels = event.upcomingChannels {
                            ChannelsLabel(channels: channels)
                                .frame(maxWidth: Metrics.tennisChannels)
                        }
                    }
                }
                if !sets.isEmpty {
                    VStack(spacing: Metrics.tennisLineGap) {
                        games(side: 0)
                        games(side: 1)
                    }
                }
            }
        }
        .padding(.vertical, Metrics.tennisRowPad)
        .rowSurface(focused: isFocused, resting: 0)
    }

    private var caption: String? {
        guard let name = event.competition?.name else { return nil }
        return [name, event.round].compactMap { $0 }.joined(separator: " · ")
    }

    private func player(_ team: TeamRef?, side: Int) -> some View {
        HStack(spacing: Metrics.tennisNameGap) {
            PersonMark(photo: team?.photo, flag: team?.flag, monogram: team?.short ?? "", size: Metrics.tennisMark)
            Text(verbatim: team.map(Self.shortName) ?? "")
                .font(.callout.weight(.medium))
                .foregroundStyle(winner == nil || winner == side ? .primary : .secondary)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .frame(height: Metrics.tennisLine)
    }

    /// "Renata Zarazua" as "R. Zarazua", the way the tours print a draw.
    static func shortName(_ team: TeamRef) -> String {
        let parts = team.name.split(separator: " ")
        guard parts.count > 1, let initial = parts.first?.first else { return team.name }
        let surname = team.nick ?? parts.dropFirst().joined(separator: " ")
        return "\(initial). \(surname)"
    }

    /// One player's games per set, each in its own column so the sets line
    /// up across the two lines and from match to match; the arrow after
    /// the winner, its room kept on the other line.
    private func games(side: Int) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(sets.enumerated()), id: \.offset) { i, pair in
                let mine = pair.indices.contains(side) ? pair[side] : 0
                let theirs = pair.indices.contains(1 - side) ? pair[1 - side] : 0
                let inPlay = live && i == sets.count - 1
                Text(verbatim: String(mine))
                    .font(.system(size: Metrics.tennisGames, weight: .bold).width(.condensed))
                    .monospacedDigit()
                    .foregroundStyle(inPlay || mine > theirs ? .primary : .secondary)
                    .frame(width: Metrics.tennisSetColumn)
            }
            Image(systemName: "arrowtriangle.left.fill")
                .font(.system(size: Metrics.tennisGames * 0.45))
                .opacity(winner == side ? 1 : 0)
                .frame(width: Metrics.tennisArrow)
        }
        .frame(height: Metrics.tennisLine)
    }
}

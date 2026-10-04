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

    /// Nobody has won a match still in play.
    private var winner: Int? { event.tennisWinner }

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
                        if let channels = event.channelList {
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

    private func games(side: Int) -> some View {
        SetGames(sets: sets, side: side, inPlay: live, won: winner == side)
    }
}

import SwiftUI

/// Apple Sports row shape: the crest with the name under it, the score
/// beside it, the status in the middle, and the same mirrored for the away
/// side. Stacked rather than side by side (Julien, 2026-09-19, from the
/// Apple Sports app: "the logo and the name on the bottom"): the crest is
/// what the eye reads from the sofa, and the name sits under it in small
/// type as a caption.
struct MatchRow: View {
    let event: Event
    @Environment(\.openGame) private var openGame

    var body: some View {
        Button {
            openGame(event)
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
        VStack(spacing: 6) {
            // Where a tennis match is, in grey over it: "Beijing · Round of 32".
            if let caption {
                Text(verbatim: caption)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            line
        }
        .padding(.vertical, Metrics.matchRowPad)
        .rowSurface(focused: isFocused, resting: 0)
        .environment(\.onLightSurface, isFocused)
    }

    private var caption: String? {
        guard let name = event.competition?.name else { return nil }
        return [name, event.round].compactMap { $0 }.joined(separator: " · ")
    }

    private var line: some View {
        HStack(spacing: 0) {
            side(event.home)
            middle(event.score?.home, record: event.records?.home, winner: winner == .home)
                .frame(width: Metrics.matchScore, alignment: .center)
            StatusLabel(status: event.status, start: event.start, compact: true, sport: event.sport)
                .frame(maxWidth: .infinity)
            middle(event.score?.away, record: event.records?.away, winner: winner == .away)
                .frame(width: Metrics.matchScore, alignment: .center)
            side(event.away)
        }
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
                    PersonMark(photo: team.photo, flag: team.flag, monogram: team.short, size: Metrics.matchMark)
                } else {
                    TeamMark(code: team.short, logo: team.logo, size: Metrics.matchMark)
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

    /// Beside the crest: the score once there is one; before, the side's
    /// record in small grey where the score will go, as Apple Sports.
    @ViewBuilder
    private func middle(_ value: Int?, record: String?, winner: Bool) -> some View {
        if event.status.state == .scheduled, let record {
            Text(verbatim: record)
                .font(.callout.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(.secondary)
        } else {
            scoreText(value, winner: winner)
        }
    }

    private func scoreText(_ value: Int?, winner: Bool) -> some View {
        Text(value.map { String($0) } ?? "–")
            .font(.system(size: Metrics.matchScoreType, weight: .bold).width(.condensed))
            .monospacedDigit()
            .foregroundStyle(loser(winner) ? .secondary : .primary)
    }

    private func loser(_ isWinner: Bool) -> Bool {
        self.winner != .nobody && !isWinner
    }
}

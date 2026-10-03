import SwiftUI

/// One player's games per set, each in its own column so the sets line up
/// across the two players and from match to match — "6 3 7", never "637"
/// (Julien, 2026-10-03, on the match page) — and the arrow after the
/// winner, its room kept on the loser's line. A set that player lost is
/// greyed, as a beaten team's score is; the set in play is not, since
/// nobody has lost it yet. Shared by the list's row and the match's page.
struct SetGames: View {
    /// [player 1's games, player 2's games] per set.
    let sets: [[Int]]
    /// Which side of the pair is this player.
    let side: Int
    /// The last set is still being played.
    var inPlay = false
    /// This player won the match.
    var won = false

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(sets.enumerated()), id: \.offset) { i, pair in
                let mine = pair[safe: side] ?? 0
                let theirs = pair[safe: 1 - side] ?? 0
                let current = inPlay && i == sets.count - 1
                Text(verbatim: String(mine))
                    .font(.system(size: Metrics.tennisGames, weight: .bold).width(.condensed))
                    .monospacedDigit()
                    .foregroundStyle(current || mine > theirs ? .primary : .secondary)
                    .frame(width: Metrics.tennisSetColumn)
            }
            Image(systemName: "arrowtriangle.left.fill")
                .font(.system(size: Metrics.tennisGames * 0.45))
                .opacity(won ? 1 : 0)
                .frame(width: Metrics.tennisArrow)
        }
        .frame(height: Metrics.tennisLine)
    }
}

extension Event {
    /// The games of every set, for a tennis match under way or over.
    var setScores: [[Int]]? {
        guard sport == "tennis", status.state != .scheduled, let sets = score?.sets, !sets.isEmpty else { return nil }
        return sets
    }

    /// Who won a tennis match, 0 or 1: the feed's word, since a retirement
    /// can leave the winner behind on sets, else sets won. Nobody has won a
    /// match still in play.
    var tennisWinner: Int? {
        guard status.state == .final else { return nil }
        switch score?.winner {
        case "home": return 0
        case "away": return 1
        default:
            guard let h = score?.home, let a = score?.away, h != a else { return nil }
            return h > a ? 0 : 1
        }
    }
}

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

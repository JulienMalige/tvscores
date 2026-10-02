import SwiftUI

/// One player's games, set by set — "6 3 7" — where a team's score goes:
/// a tennis result reads "6-2 6-3", not the "1-0" of sets won (Julien,
/// build 31). A set that player lost is greyed, as a beaten team's score is;
/// the set in play is not, since nobody has lost it yet.
struct SetScores: View {
    /// [player's games, opponent's games] per set.
    let sets: [[Int]]
    /// Which side of the pair is this player.
    let side: Int
    let size: CGFloat
    /// The last set is still being played.
    var inPlay = false

    var body: some View {
        sets.enumerated().reduce(Text(verbatim: "")) { line, entry in
            let (i, pair) = entry
            let mine = pair[safe: side] ?? 0, theirs = pair[safe: 1 - side] ?? 0
            let current = inPlay && i == sets.count - 1
            let lost = !current && mine < theirs
            return line
                + Text(verbatim: i == 0 ? "" : " ")
                + Text(verbatim: String(mine)).foregroundStyle(lost ? Color.white.opacity(0.4) : .white)
        }
        .font(.system(size: size, weight: .bold).width(.condensed))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.5)
    }
}

extension Event {
    /// The games of every set, for a tennis match under way or over.
    var setScores: [[Int]]? {
        guard sport == "tennis", status.state != .scheduled, let sets = score?.sets, !sets.isEmpty else { return nil }
        return sets
    }
}

private extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

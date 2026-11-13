import SwiftUI

/// A goal or a card: the minute, its mark, the player — on the home side's
/// left or the away side's right.
struct MomentRow: View {
    let moment: GameDetail.Moment

    var body: some View {
        HStack(spacing: .tv(14)) {
            if !moment.isHome { Spacer() }
            if moment.isHome { minute; mark; player } else { player; mark; minute }
            if moment.isHome { Spacer() }
        }
        .font(.callout.weight(.medium))
    }

    private var minute: some View {
        Text(verbatim: "\(moment.minute)'")
            .monospacedDigit()
            .foregroundStyle(.secondary)
            .frame(width: .tv(70), alignment: moment.isHome ? .leading : .trailing)
    }

    @ViewBuilder
    private var mark: some View {
        switch moment.kind {
        case "yellow": RoundedRectangle(cornerRadius: .tv(3)).fill(Color.yellow).frame(width: .tv(18), height: .tv(24))
        case "red": RoundedRectangle(cornerRadius: .tv(3)).fill(Color.red).frame(width: .tv(18), height: .tv(24))
        default: Image(systemName: "soccerball").foregroundStyle(moment.kind == "ownGoal" ? .red : .primary)
        }
    }

    private var player: some View {
        HStack(spacing: .tv(6)) {
            Text(verbatim: moment.player ?? "")
            if moment.kind == "penalty" { Text("game.penalty").foregroundStyle(.secondary) }
            if moment.kind == "ownGoal" { Text("game.ownGoal").foregroundStyle(.secondary) }
        }
    }
}

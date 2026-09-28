import SwiftUI

/// The score by quarter, as a small table: a column per period, then the total.
struct PeriodSection: View {
    let periods: GameDetail.Periods
    let home: TeamRef?
    let away: TeamRef?

    var body: some View {
        FocusBlock(identifier: "game.periods") {
            Grid(horizontalSpacing: 12, verticalSpacing: 14) {
                GridRow {
                    Text(verbatim: "").gridColumnAlignment(.leading)
                    ForEach(Array(periods.labels.enumerated()), id: \.offset) { _, label in
                        Text(verbatim: label).foregroundStyle(.secondary)
                    }
                    Text("game.total").foregroundStyle(.secondary)
                }
                .font(.callout.weight(.semibold))
                line(home?.short, periods.home)
                line(away?.short, periods.away)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func line(_ name: String?, _ values: [Int]) -> some View {
        GridRow {
            Text(verbatim: name ?? "").font(.title3.weight(.semibold))
            ForEach(Array(values.enumerated()), id: \.offset) { _, v in
                Text(verbatim: "\(v)").frame(width: Metrics.tableCell)
            }
            Text(verbatim: "\(values.reduce(0, +))").bold().frame(width: Metrics.tableCell)
        }
        .font(.title3)
        .monospacedDigit()
    }
}

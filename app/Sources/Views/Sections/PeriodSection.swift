import SwiftUI

/// The score by quarter, laid across the page under the header as Apple
/// Sports does: no panel, a column per period, then the total, and a hair
/// line between the two sides.
struct PeriodSection: View {
    let periods: GameDetail.Periods
    let home: TeamRef?
    let away: TeamRef?

    var body: some View {
        FocusBlock(identifier: "game.periods", surface: false) {
            Grid(horizontalSpacing: 0, verticalSpacing: 18) {
                GridRow {
                    Text(verbatim: "").frame(width: Metrics.periodName, alignment: .leading)
                    ForEach(Array(periods.labels.enumerated()), id: \.offset) { _, label in
                        cell(Text(verbatim: label))
                    }
                    cell(Text("game.total"))
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                line(home?.short, periods.home)
                Divider().overlay(Color.white.opacity(0.25))
                line(away?.short, periods.away)
            }
        }
    }

    private func cell(_ text: Text) -> some View {
        text.frame(maxWidth: .infinity)
    }

    private func line(_ name: String?, _ values: [Int]) -> some View {
        GridRow {
            Text(verbatim: name ?? "")
                .font(.caption.weight(.bold))
                .frame(width: Metrics.periodName, alignment: .leading)
            ForEach(Array(values.enumerated()), id: \.offset) { _, v in
                cell(Text(verbatim: "\(v)"))
            }
            cell(Text(verbatim: "\(values.reduce(0, +))").bold())
        }
        .font(.caption.weight(.medium))
        .monospacedDigit()
    }
}

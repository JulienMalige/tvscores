import SwiftUI

/// The name over one column of a table read as numbers ("Pts", "Diff"),
/// over the right edge of its numbers and on one line: French's "Bonus"
/// broke in two over the rugby tables' bonus points (build 48's
/// screenshots), and is set a little smaller instead.
struct ColumnLabel: View {
    let column: String

    var body: some View {
        Text(LocalizedStringKey("col." + column))
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: Metrics.tableCell, alignment: .trailing)
            .accessibilityIdentifier("col." + column)
    }
}

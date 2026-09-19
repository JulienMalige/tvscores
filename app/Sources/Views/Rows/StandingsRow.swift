import SwiftUI

/// One line of a league table: rank, mark, name, points.
struct StandingsRow: View {
    let entry: StandingsEntry

    var body: some View {
        Button {
            // A driver or team page comes later.
        } label: {
            StandingsRowContent(entry: entry)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("standing.\(entry.pos)")
    }
}

private struct StandingsRowContent: View {
    let entry: StandingsEntry
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 20) {
            Text("\(entry.pos)")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .monospacedDigit()
                .frame(width: 64, alignment: .trailing)
            mark
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.title3.weight(.semibold))
                if let sub = entry.sub {
                    Text(sub).font(.callout).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let cells = entry.cells {
                // A table read as numbers: one column each, the last — the
                // points, or the percentage — carrying the weight.
                ForEach(Array(cells.enumerated()), id: \.offset) { i, cell in
                    Text(cell)
                        .font(.system(size: i == cells.count - 1 ? 34 : 28, weight: i == cells.count - 1 ? .bold : .regular, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7) // "1.000" fits the column rather than wrapping
                        .foregroundStyle(i == cells.count - 1 ? .primary : .secondary)
                        .frame(width: Metrics.tableCell, alignment: .trailing)
                }
            } else if let v = entry.value {
                Text(v, format: .number.grouping(.automatic))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
        }
        .rowSurface(focused: isFocused)
    }

    /// Constructors and teams arrive as a composed badge; people as a portrait.
    @ViewBuilder
    private var mark: some View {
        if let logo = entry.logo {
            CachedImage(url: logo) { Color.clear }
                .frame(width: Metrics.mark, height: Metrics.mark)
        } else {
            PersonMark(photo: entry.photo, flag: entry.flag, color: Color(hex: entry.color),
                       monogram: entry.code ?? PersonMark.monogram(for: entry.name), size: Metrics.mark)
        }
    }
}

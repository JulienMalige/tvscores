import SwiftUI

/// One line of a league table: rank, mark, name, points.
struct StandingsRow: View {
    let entry: StandingsEntry
    /// One of the two teams of the game whose page this table is on.
    var highlighted = false
    /// On a game card's panel: lines without a card each, as Apple Sports.
    var plain = false

    var body: some View {
        Button {
            // A driver or team page comes later.
        } label: {
            StandingsRowContent(entry: entry, highlighted: highlighted, plain: plain)
        }
        .buttonStyle(QuietButtonStyle())
        .accessibilityIdentifier("standing.\(entry.pos)")
    }
}

private struct StandingsRowContent: View {
    let entry: StandingsEntry
    let highlighted: Bool
    let plain: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        // Apple Sports' table, doubled for the room (docs/design-measures.md):
        // rank and name at the row's text size, a small crest, rows 80 apart.
        HStack(spacing: 24) {
            Text("\(entry.pos)")
                .font(.callout)
                .monospacedDigit()
                .frame(width: 44, alignment: .trailing)
            mark
            VStack(alignment: .leading, spacing: 0) {
                Text(entry.name)
                    .font(.callout.weight(highlighted ? .bold : .regular))
                if let sub = entry.sub {
                    Text(sub).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            HStack(spacing: Metrics.tableGap) {
            if let cells = entry.cells {
                // A table read as numbers: one column each, the last — the
                // points, or the percentage — carrying the weight.
                ForEach(Array(cells.enumerated()), id: \.offset) { i, cell in
                    Text(cell)
                        .font(.callout.weight(i == cells.count - 1 ? .semibold : .regular))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.7) // "1.000" fits the column rather than wrapping
                        .foregroundStyle(i == cells.count - 1 ? .primary : .secondary)
                        .frame(width: Metrics.tableCell, alignment: .trailing)
                }
            } else if let v = entry.value {
                Text(v, format: .number.grouping(.automatic))
                    .font(.callout)
                    .monospacedDigit()
            }
            }
        }
        .rowSurface(focused: isFocused, resting: plain ? 0 : 0.04, insetV: Metrics.tableRowPad)
        // A game's two sides, a shade lighter, as Apple Sports picks them out.
        .background(
            RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous)
                .fill(Color.white.opacity(highlighted ? 0.1 : 0))
        )
    }

    /// Constructors and teams arrive as a composed badge; people as a portrait.
    @ViewBuilder
    private var mark: some View {
        if let logo = entry.logo {
            CachedImage(url: logo) { Color.clear }
                .frame(width: Metrics.tableMark, height: Metrics.tableMark)
        } else {
            PersonMark(photo: entry.photo, flag: entry.flag, color: Color(hex: entry.color),
                       monogram: entry.code ?? PersonMark.monogram(for: entry.name), size: Metrics.tableMark * 1.2)
        }
    }
}

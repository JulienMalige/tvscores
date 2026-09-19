import SwiftUI

/// The league table under a competition's games: a heading, a switch between
/// the tables the provider publishes (drivers and constructors, riders and
/// teams, the two conferences), and the rows of whichever is chosen. It loads its own data so the screen above it
/// only has to say which competition it is.
struct StandingsSection: View {
    let ref: LeagueRef
    let store: ScoreboardStore

    @State private var standings: Standings?
    @State private var loaded = false
    @State private var table = 0

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            Text("standings.title")
                .font(.title2.weight(.bold))
                .padding(.top, 12)
            if let standings, !standings.tables.isEmpty {
                if standings.tables.count > 1 { tabs(standings) }
                rows(standings.tables[min(table, standings.tables.count - 1)])
            } else if loaded {
                Text("standings.unavailable")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        }
        .task {
            standings = await store.standings(for: ref)
            loaded = true
            if let standings { await ImagePrefetcher.shared.prefetch(standings.imageURLs) }
            // `-TVScoresTable constructors` opens that table (CI screenshots).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-TVScoresTable"), i + 1 < args.count,
               let hit = standings?.tables.firstIndex(where: { $0.id == args[i + 1] }) {
                table = hit
            }
        }
    }

    private func tabs(_ standings: Standings) -> some View {
        Segments(selection: $table, options: standings.tables.enumerated().map { ($0.offset, title($0.element.id)) })
            .accessibilityIdentifier("table.switch")
    }

    private func rows(_ table: StandingsTable) -> some View {
        VStack(spacing: Metrics.rowGap) {
            if let columns = table.columns, table.rows.first?.section == nil { columnHeader(columns) }
            ForEach(Array(table.rows.enumerated()), id: \.element.id) { i, entry in
                // A division's name above its first row, with the columns
                // again: a conference is read division by division.
                if let section = entry.section, i == 0 || table.rows[i - 1].section != section {
                    HStack {
                        Text(section)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.leading, Metrics.rowInsetH)
                            .accessibilityIdentifier("division.\(section)")
                        Spacer()
                        if let columns = table.columns { columnLabels(columns) }
                    }
                    .padding(.top, i == 0 ? 0 : Metrics.headingGap)
                    .padding(.trailing, Metrics.rowInsetH)
                }
                StandingsRow(entry: entry)
                if let line = table.lines?.first(where: { $0.after == entry.pos && entry.section == nil }) {
                    cut(line.line)
                }
            }
            if let legend = table.legend, !legend.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(legend, id: \.key) { zone in
                        // A key built from a value, not interpolated: inside
                        // a LocalizedStringKey literal, "\(x)" is a format
                        // argument, and the catalogue is asked for "zone.%@".
                        Text(verbatim: "\(zone.from == zone.to ? "\(zone.from)" : "\(zone.from)–\(zone.to)"): ") + Text(LocalizedStringKey("zone." + zone.key))
                    }
                }
                .font(.callout)
                .foregroundStyle(.secondary)
                .padding(.leading, Metrics.rowInsetH)
                .padding(.top, Metrics.headingGap)
            }
        }
    }

    /// The column names over a table read as numbers.
    private func columnHeader(_ columns: [String]) -> some View {
        HStack {
            Spacer()
            columnLabels(columns)
        }
        .padding(.trailing, Metrics.rowInsetH)
    }

    private func columnLabels(_ columns: [String]) -> some View {
        HStack(spacing: 20) {
            ForEach(columns, id: \.self) { column in
                Text(LocalizedStringKey("col." + column))
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(width: Metrics.tableCell, alignment: .trailing)
                    .accessibilityIdentifier("col." + column)
            }
        }
    }

    /// Where the table is cut: a line, solid or dashed, across the rows.
    private func cut(_ style: String) -> some View {
        Rectangle()
            .fill(.clear)
            .frame(height: 2)
            .overlay(
                Path { p in
                    p.move(to: .zero)
                    p.addLine(to: CGPoint(x: 4000, y: 0))
                }
                .stroke(Color.white.opacity(0.45), style: StrokeStyle(lineWidth: 2, dash: style == "dashed" ? [14, 12] : []))
            )
            .clipped()
            .padding(.horizontal, Metrics.rowInsetH)
            .padding(.vertical, 6)
            .accessibilityIdentifier("table.cut.\(style)")
    }

    private func title(_ id: String) -> LocalizedStringKey {
        switch id {
        case "drivers": "standings.drivers"
        case "constructors": "standings.constructors"
        case "teams": "standings.teams"
        case "rankings": "standings.rankings"
        case "east": "standings.east"
        case "west": "standings.west"
        default: LocalizedStringKey(id) // "AFC", "NFC": names, not words
        }
    }
}

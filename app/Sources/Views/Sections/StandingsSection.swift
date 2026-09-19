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
            ForEach(table.rows) { entry in
                StandingsRow(entry: entry)
            }
        }
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

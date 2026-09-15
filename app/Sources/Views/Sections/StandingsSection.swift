import SwiftUI

/// The league table under a competition's games: a heading, one pill per table
/// the provider publishes (drivers and constructors, riders and teams), and the
/// rows of whichever is selected. It loads its own data so the screen above it
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
            // `-TVScoresTable constructors` opens that table (CI screenshots).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-TVScoresTable"), i + 1 < args.count,
               let hit = standings?.tables.firstIndex(where: { $0.id == args[i + 1] }) {
                table = hit
            }
        }
    }

    private func tabs(_ standings: Standings) -> some View {
        HStack(spacing: 20) {
            ForEach(Array(standings.tables.enumerated()), id: \.offset) { i, t in
                Button(title(t.id)) { table = i }
                    .buttonStyle(.bordered)
                    .fontWeight(table == i ? .bold : .regular)
            }
            Spacer()
        }
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
        default: LocalizedStringKey(id)
        }
    }
}

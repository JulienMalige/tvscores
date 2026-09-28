import SwiftUI

/// A finished or live game's statistics: each a line with both sides' values
/// and a bar between them, as Apple Sports draws its team stats.
struct StatsSection: View {
    let stats: [GameDetail.Stat]

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text("game.statistics").font(.title2.weight(.bold))
            ForEach(stats) { StatRow(stat: $0) }
        }
    }
}

import SwiftUI

/// A finished or live game's statistics, in one panel: each a line with both
/// sides' values and a bar each, in the sides' colours, as Apple Sports
/// draws its team stats.
struct StatsSection: View {
    let stats: [GameDetail.Stat]
    var homeTint: Color?
    var awayTint: Color?

    var body: some View {
        GameCard(title: "game.statistics", identifier: "game.stats") {
            VStack(spacing: 22) {
                ForEach(stats) { StatRow(stat: $0, homeTint: homeTint, awayTint: awayTint) }
            }
        }
    }
}

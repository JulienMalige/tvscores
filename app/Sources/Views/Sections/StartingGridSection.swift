import SwiftUI

/// The starting grid on a panel, as Apple Sports' "Starting Grid": the
/// title centred, then every car in the order it lines up, each with its
/// team under the name. Read from qualifying, so a grid penalty handed out
/// afterwards is not in it.
struct StartingGridSection: View {
    let results: [RaceResult]

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text("race.startingGrid")
                .font(.callout.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.bottom, Metrics.cardGap - Metrics.rowGap)
            ForEach(results) { StartingGridRow(result: $0) }
        }
        // On a panel, as the race's result is.
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, 16)
        .gameCardSurface(radius: Metrics.gameCardRadius)
    }
}

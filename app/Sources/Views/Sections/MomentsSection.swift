import SwiftUI

/// A football game's goals and cards, minute by minute, each on its side.
struct MomentsSection: View {
    let moments: [GameDetail.Moment]

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text("game.moments").font(.title2.weight(.bold))
            FocusBlock(identifier: "game.moments") {
                VStack(spacing: 14) {
                    ForEach(Array(moments.enumerated()), id: \.offset) { _, moment in
                        MomentRow(moment: moment)
                    }
                }
            }
        }
    }
}

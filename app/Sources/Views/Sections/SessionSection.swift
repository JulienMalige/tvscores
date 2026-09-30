import SwiftUI

/// A race weekend's timetable on a panel, as Apple Sports' "Schedule":
/// the title centred, then each session with its day over its time, a
/// fine rule between them.
struct SessionSection: View {
    let sessions: [Session]

    var body: some View {
        VStack(spacing: 0) {
            Text("race.schedule")
                .font(.callout.weight(.semibold))
                .padding(.bottom, Metrics.cardGap)
            ForEach(sessions.sorted { $0.start < $1.start }) { session in
                RowRule()
                SessionRow(session: session)
            }
        }
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .gameCardSurface(radius: Metrics.gameCardRadius)
    }
}

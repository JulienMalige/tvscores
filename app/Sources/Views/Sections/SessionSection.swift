import SwiftUI

/// A race weekend's timetable: qualifying, the sprint, the race.
struct SessionSection: View {
    let sessions: [Session]

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            Text("race.weekend")
                .font(.title2.weight(.bold))
            VStack(spacing: Metrics.rowGap) {
                ForEach(sessions) { SessionRow(session: $0) }
            }
        }
    }
}

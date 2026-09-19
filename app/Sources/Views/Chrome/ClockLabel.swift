import SwiftUI

/// The date at the top of a page, and the time at the top of the menu —
/// where the Apple TV app keeps its clock. The profile picture and name
/// beside it there are Apple's own, drawn only in Apple's apps; an app gets
/// the header slot and fills it with what it has.
struct ClockLabel: View {
    var showsDate = true
    var showsTime = true

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { tick in
            HStack(spacing: 14) {
                if showsDate {
                    Text(tick.date, format: .dateTime.weekday(.wide).day().month(.wide))
                }
                if showsTime {
                    Text(tick.date, format: .dateTime.hour().minute())
                        .monospacedDigit()
                        .foregroundStyle(.primary)
                }
            }
            .font(.title3)
            .foregroundStyle(.secondary)
        }
    }
}

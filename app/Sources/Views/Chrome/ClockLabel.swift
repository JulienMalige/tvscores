import SwiftUI

/// The date and time at the top of a page — where the Apple TV app keeps
/// its clock, beside a profile that is Apple's own to draw.
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

import SwiftUI

/// The time, ticking, beside the date at the top of a page.
///
/// tvOS puts the clock in its own sidebar, above the profile — but that
/// sidebar is the system's, drawn over the app and not ours to add to. An app
/// gets the page, so the clock lives where the date already is.
struct ClockLabel: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { tick in
            HStack(spacing: 14) {
                Text(tick.date, format: .dateTime.weekday(.wide).day().month(.wide))
                Text(tick.date, format: .dateTime.hour().minute())
                    .monospacedDigit()
                    .foregroundStyle(.primary)
            }
            .font(.title3)
            .foregroundStyle(.secondary)
        }
    }
}

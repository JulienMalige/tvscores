import SwiftUI

/// The three day pills. The system `.bordered` style is deliberate: on tvOS a
/// custom pill loses the focus behaviour people already know.
struct DayTabs: View {
    @Binding var selected: Day

    var body: some View {
        HStack(spacing: 24) {
            ForEach(Day.allCases) { d in
                DayPill(title: title(d), isSelected: selected == d) { selected = d }
                    .accessibilityIdentifier("day.\(d.rawValue)")
            }
            Spacer()
        }
        // No claim on focus at all — no `.defaultFocus`, no `.focusSection`.
        //
        // The pills used to declare a default so the highlight would start on
        // the selected day. The flows timed what that cost: a menu opened and
        // then left alone shut itself within one to four seconds, and focus was
        // found on the leading pill afterwards — the engine re-seeding from the
        // page after the pills' claim pulled it out of the sidebar. A menu being
        // navigated survived, which is why it only sometimes happened to a
        // person. The selected day is filled in, so where the highlight starts
        // no longer needs saying.
    }

    /// A day, filled when it is the one being shown.
    ///
    /// Selection used to be carried by the type weight alone, which is
    /// invisible beside the focus ring: tvOS lights the pill the remote is
    /// pointing at, and that read as "Yesterday is selected" while today's
    /// matches were on screen. Both styles are the system's own — prominent
    /// for the day being shown, plain for the others — so focus and selection
    /// say different things.
    private struct DayPill: View {
        let title: LocalizedStringKey
        let isSelected: Bool
        let pick: () -> Void

        var body: some View {
            if isSelected {
                Button(title, action: pick).buttonStyle(.borderedProminent)
            } else {
                Button(title, action: pick).buttonStyle(.bordered)
            }
        }
    }

    private func title(_ d: Day) -> LocalizedStringKey {
        switch d {
        case .yesterday: "tab.yesterday"
        case .today: "tab.today"
        case .upcoming: "tab.upcoming"
        }
    }
}

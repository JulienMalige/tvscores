import SwiftUI

/// The three day pills. The system `.bordered` style is deliberate: on tvOS a
/// custom pill loses the focus behaviour people already know.
struct DayTabs: View {
    @Binding var selected: Day
    @FocusState private var focused: Day?

    var body: some View {
        HStack(spacing: 24) {
            ForEach(Day.allCases) { d in
                DayPill(title: title(d), isSelected: selected == d) { selected = d }
                    .focused($focused, equals: d)
                    .accessibilityIdentifier("day.\(d.rawValue)")
            }
            Spacer()
        }
        // A plain default so the highlight starts on the selected day, and
        // nothing that takes focus by hand: a `.task` that asserted focus here
        // re-ran on every reappearance and pulled focus out of the sidebar as
        // it opened. This default was once suspected of the same and cleared
        // — wrongly: when the menu lost focus, focus landed on the leading
        // pill, not this one, which is the engine re-seeding from nothing.
        .defaultFocus($focused, selected)
        .focusSection()
        // Picking a day swaps the pill for its filled twin, and the focus
        // engine loses the view it was on. Put it back on the day just
        // picked — on a pick only, never on appearance, so the menu is never
        // robbed of it.
        .onChange(of: selected) { _, now in focused = now }
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

import SwiftUI

/// The three day pills on a competition's page. The system `.bordered` style
/// is deliberate: on tvOS a custom pill loses the focus behaviour people
/// already know.
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
        // re-ran on every reappearance and pulled focus around the page.
        .defaultFocus($focused, selected)
        .focusSection()
        // Picking a day swaps the pill for its filled twin — two system
        // styles, not one restyled, because a wrapped style loses the fill —
        // and the focus engine loses the view it was on. Put focus back on
        // the day just picked, a beat later so the new pill exists to take
        // it. On a pick only, never on appearance.
        .onChange(of: selected) { _, now in
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(80))
                focused = now
            }
        }
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

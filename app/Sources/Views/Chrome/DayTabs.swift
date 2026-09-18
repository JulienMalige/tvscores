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
    }

    /// A day, in bold when it is the one being shown — the way the standings
    /// picker says it, and the only way tvOS shows: an unfocused prominent
    /// button is drawn exactly like a plain one, so a fill never appeared.
    /// One button whose weight changes, not two swapped: the swap destroyed
    /// the focused control, and focus fell to the leading pill.
    private struct DayPill: View {
        let title: LocalizedStringKey
        let isSelected: Bool
        let pick: () -> Void

        var body: some View {
            Button(action: pick) {
                Text(title).fontWeight(isSelected ? .bold : .regular)
            }
            .buttonStyle(.bordered)
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

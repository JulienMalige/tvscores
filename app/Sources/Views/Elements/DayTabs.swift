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
            }
            Spacer()
        }
        // Plain `.defaultFocus`, and nothing that takes focus by hand.
        //
        // This used to assert focus in a `.task`, and to claim `.userInitiated`
        // priority, because the pills were the only focusable chrome and the
        // engine would otherwise start on the leading one. The sidebar changed
        // that: a `.task` runs again every time the view reappears, so opening
        // the sidebar — which reappears the page behind it — pulled focus
        // straight back out of the menu, and the menu shut as it opened.
        .defaultFocus($focused, selected)
        .focusSection()
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

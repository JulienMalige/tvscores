import SwiftUI

/// The three day pills. The system `.bordered` style is deliberate: on tvOS a
/// custom pill loses the focus behaviour people already know.
struct DayTabs: View {
    @Binding var selected: Day
    @FocusState private var focused: Day?

    var body: some View {
        HStack(spacing: 24) {
            ForEach(Day.allCases) { d in
                Button {
                    selected = d
                } label: {
                    Text(title(d))
                        .fontWeight(selected == d ? .bold : .regular)
                }
                .buttonStyle(.bordered)
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

    private func title(_ d: Day) -> LocalizedStringKey {
        switch d {
        case .yesterday: "tab.yesterday"
        case .today: "tab.today"
        case .upcoming: "tab.upcoming"
        }
    }
}

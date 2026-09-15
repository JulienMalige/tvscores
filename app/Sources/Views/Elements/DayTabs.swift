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
        .defaultFocus($focused, selected, priority: .userInitiated)
        .focusSection()
        .task {
            // The focus engine settles after the first layout pass, and inside a
            // safe-area inset that happens later than onAppear. Re-assert once so
            // the highlight starts on the selected day, not the leading tab.
            focused = selected
            await Task.yield()
            focused = selected
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

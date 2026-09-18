import SwiftUI

/// The day switch: Yesterday, Today, Upcoming, as the system's segmented
/// control, under the title and hugging its labels on the left.
///
/// tvOS selects a segment as focus reaches it and draws the one the remote is
/// on in white, the chosen one in grey once focus has moved on — the system's
/// own language, and the focus behaviour comes for free. The pills it
/// replaced were three buttons of ours, and keeping focus on the one just
/// picked while it was restyled took more code than the switch itself.
struct DayTabs: View {
    @Binding var selected: Day

    var body: some View {
        HStack {
            Picker("tab.day", selection: $selected) {
                ForEach(Day.allCases) { d in
                    Text(title(d)).tag(d)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            .accessibilityIdentifier("day.switch")
            Spacer()
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

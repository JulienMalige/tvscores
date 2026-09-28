import SwiftUI

/// The day switch: Yesterday, Today, Upcoming, under the title on the left.
struct DayTabs: View {
    @Binding var selected: Day

    var body: some View {
        Segments(selection: $selected, options: Day.allCases.map { .init(value: $0, title: Text(title($0))) }, claimsFocus: true)
            .accessibilityIdentifier("day.switch")
    }

    private func title(_ d: Day) -> LocalizedStringKey {
        switch d {
        case .yesterday: "tab.yesterday"
        case .today: "tab.today"
        case .upcoming: "tab.upcoming"
        }
    }
}

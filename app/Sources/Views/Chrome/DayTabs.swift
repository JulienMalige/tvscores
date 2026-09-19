import SwiftUI

/// The day switch: Yesterday, Today, Upcoming, under the title on the left.
struct DayTabs: View {
    @Binding var selected: Day

    var body: some View {
        HStack {
            Segments(selection: $selected, options: Day.allCases.map { ($0, title($0)) })
                .fixedSize()
                .accessibilityIdentifier("day.switch")
            Spacer()
        }
    }

    private func title(_ d: Day) -> String {
        switch d {
        case .yesterday: String(localized: "tab.yesterday")
        case .today: String(localized: "tab.today")
        case .upcoming: String(localized: "tab.upcoming")
        }
    }
}

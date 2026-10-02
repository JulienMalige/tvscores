import SwiftUI

/// Upcoming, day by day, as Apple Sports lists it: a date heading
/// ("Sat, 3 Oct"), then that day's competitions, each row showing its time
/// alone since the day is said above it (Julien, build 28), and a rule
/// between one day and the next (build 32), not Apple's collapsing.
struct DaySection<Row: View>: View {
    let day: Date
    let groups: [LeagueGroup]
    /// A rule over the heading, between one day and the next; the first
    /// day sits under the day switch's own.
    var ruled = true
    @ViewBuilder var row: (LeagueGroup) -> Row

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            if ruled { RowRule() }
            Text(day, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                .font(.caption.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.top, Metrics.headingGap / 2)
            ForEach(groups) { group in row(group) }
        }
        .environment(\.underDayHeading, true)
    }
}

extension LeagueGroup {
    /// Groups cut by the viewer's calendar day, earliest first, each day's
    /// competitions in the order the board gives them.
    static func byDay(_ groups: [LeagueGroup], calendar: Calendar = .current) -> [(day: Date, groups: [LeagueGroup])] {
        var days: [Date: [LeagueGroup]] = [:]
        for group in groups {
            let split = Dictionary(grouping: group.events) { calendar.startOfDay(for: $0.start) }
            for (day, events) in split {
                days[day, default: []].append(LeagueGroup(sport: group.sport, league: group.league, events: events))
            }
        }
        return days.keys.sorted().map { ($0, days[$0] ?? []) }
    }
}

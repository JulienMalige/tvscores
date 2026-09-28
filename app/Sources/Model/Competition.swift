import Foundation

/// A tennis tournament as a heading shows it. The feed has no logo and no
/// sponsor's name, so the name is the city's more often than not.
struct Competition: Decodable, Equatable {
    let name: String
    let city: String?
    let flag: String?
    /// "WTA 1000", "Grand Slam".
    let tier: String?
    /// hard | clay | grass.
    let surface: String?
    /// ISO 3166 code, "CN", for the country's name in the viewer's language.
    let country: String?
    /// "2026-09-30", from the proxy's hand-kept calendar when it knows the
    /// tournament. Kept as text and read below, so a date in another shape
    /// costs the heading its dates rather than the whole board failing to
    /// decode.
    let start: String?
    let end: String?

    /// Midnight of the first day to midnight of the last, when both dates
    /// read and are in order: the span a heading's date interval shows.
    var dates: Range<Date>? {
        guard let first = Self.day(start), let last = Self.day(end), first <= last else { return nil }
        return first..<last
    }

    /// "2026-09-30" as midnight of that day in the viewer's calendar: a
    /// tournament's days are the same numbers wherever you watch it from.
    private static func day(_ text: String?) -> Date? {
        let parts = text?.split(separator: "-").compactMap { Int($0) } ?? []
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

extension Array where Element == Event {
    /// The events in runs of one tournament, in the order the first of each
    /// appears; events with no tournament are one run of their own, last.
    func byCompetition() -> [(competition: Competition?, events: [Event])] {
        var runs: [(competition: Competition?, events: [Event])] = []
        for event in self {
            if let i = runs.firstIndex(where: { $0.competition?.name == event.competition?.name }) {
                runs[i].events.append(event)
            } else {
                runs.append((event.competition, [event]))
            }
        }
        return runs.filter { $0.competition != nil } + runs.filter { $0.competition == nil }
    }
}

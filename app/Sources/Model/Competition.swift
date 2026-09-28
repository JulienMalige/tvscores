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
}

extension Array where Element == Event {
    /// The events in runs of one tournament, in the order the first of each
    /// appears; events with no tournament are one run of their own.
    func byCompetition() -> [(competition: Competition?, events: [Event])] {
        var runs: [(competition: Competition?, events: [Event])] = []
        for event in self {
            if let i = runs.firstIndex(where: { $0.competition?.name == event.competition?.name }) {
                runs[i].events.append(event)
            } else {
                runs.append((event.competition, [event]))
            }
        }
        return runs
    }
}

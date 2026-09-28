import Observation
import SwiftUI

/// A family of sport: one entry of the menu, and the competitions under it.
struct SportSection: Hashable, Identifiable {
    let id: String
    let title: LocalizedStringKey
    let symbol: String
    let sports: [String]

    static func == (a: SportSection, b: SportSection) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// The menu, in order. A sport not named here is not shown.
    static let all: [SportSection] = [
        SportSection(id: "football", title: "sidebar.football", symbol: "soccerball", sports: ["football"]),
        SportSection(id: "motorsport", title: "sidebar.motorsport", symbol: "flag.checkered", sports: ["f1", "motogp"]),
        SportSection(id: "us", title: "sidebar.us", symbol: "sportscourt", sports: ["nfl", "nba"]),
        SportSection(id: "tennis", title: "sidebar.tennis", symbol: "tennisball", sports: ["tennis"]),
    ]

    static func of(sport: String) -> SportSection? { all.first { $0.sports.contains(sport) } }
}

/// What each sport's page shows: the competition picked (none is All) and
/// the day. Held above the pages, so the front page can open a sport on a
/// given competition and day, and each sport keeps its own while you roam.
@MainActor
@Observable
final class SportChoices {
    let initialDay: Day
    private var days: [String: Day] = [:]
    private var competitions: [String: String] = [:]

    init(initialDay: Day) { self.initialDay = initialDay }

    func day(_ section: String) -> Day { days[section] ?? initialDay }
    func setDay(_ day: Day, for section: String) { days[section] = day }

    /// "sport:id" of the competition picked, or nil for All.
    func competition(_ section: String) -> String? { competitions[section] }
    func setCompetition(_ key: String?, for section: String) { competitions[section] = key }

    static func key(sport: String, id: String) -> String { "\(sport):\(id)" }
}

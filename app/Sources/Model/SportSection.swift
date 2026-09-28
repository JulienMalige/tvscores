import SwiftUI

/// A family of sport: a heading in the menu, and the competitions under it.
struct SportSection: Identifiable {
    let id: String
    let title: LocalizedStringKey
    let sports: [String]

    /// The menu's sections, in order. A sport not named here is not shown.
    static let all: [SportSection] = [
        SportSection(id: "football", title: "sidebar.football", sports: ["football"]),
        SportSection(id: "motorsport", title: "sidebar.motorsport", sports: ["f1", "motogp"]),
        SportSection(id: "us", title: "sidebar.us", sports: ["nfl", "nba"]),
        SportSection(id: "tennis", title: "sidebar.tennis", sports: ["tennis"]),
    ]
}

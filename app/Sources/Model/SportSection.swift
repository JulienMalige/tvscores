import SwiftUI

/// A family of sport: a heading in the menu, and the competitions under it.
struct SportSection: Identifiable {
    let id: String
    let title: LocalizedStringKey
    let sports: [String]

    /// The menu's sections, in order. A sport not named here is not shown.
    static let all: [SportSection] = [
        SportSection(id: "football", title: "sidebar.football", sports: ["football"]),
        // National teams, after the clubs: leagues say so themselves, by
        // their `section` (Julien, 2026-09-28).
        SportSection(id: "international", title: "sidebar.international", sports: []),
        SportSection(id: "motorsport", title: "sidebar.motorsport", sports: ["f1", "motogp"]),
        SportSection(id: "us", title: "sidebar.us", sports: ["nfl", "nba"]),
        SportSection(id: "tennis", title: "sidebar.tennis", sports: ["tennis"]),
    ]
}

extension SportSection {
    /// The menu's families with their competitions: shown ones only unless
    /// `all`, each family in the viewer's order (Settings, build 36).
    @MainActor
    static func grouped(_ leagues: [LeagueSummary], all: Bool = false) -> [(section: SportSection, leagues: [LeagueSummary])] {
        let choice = LeagueChoice.shared
        return SportSection.all.compactMap { section in
            // A league naming its own section goes there, not in its sport's.
            let mine = leagues.filter { $0.section.map { $0 == section.id } ?? section.sports.contains($0.sport) }
                .filter { all || choice.isShown(Sidebar.key($0)) }
            let byKey = Dictionary(mine.map { (Sidebar.key($0), $0) }, uniquingKeysWith: { a, _ in a })
            let ordered = choice.arranged(mine.map(Sidebar.key)).compactMap { byKey[$0] }
            return ordered.isEmpty ? nil : (section, ordered)
        }
    }
}

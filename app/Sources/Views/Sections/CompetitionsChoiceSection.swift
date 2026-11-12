import SwiftUI

/// Settings, Competitions: every competition by family, ticked to show it.
/// Select its row to show or hide it; hold select on it — a long press on a
/// phone — to move it up or down, from the menu the system opens there.
struct CompetitionsChoiceSection: View {
    /// Every competition the proxy serves, shown or not.
    let leagues: [LeagueSummary]
    @State private var leagueChoice = LeagueChoice.shared

    var body: some View {
        List {
            ForEach(SportSection.grouped(leagues, all: true), id: \.section.id) { entry in
                let siblings = entry.leagues.map(MenuItem.key)
                Section(entry.section.title) {
                    ForEach(entry.leagues) { league in
                        row(league, siblings: siblings)
                    }
                }
            }
        }
    }

    /// One button: a list row is one place for the focus, so a handle beside
    /// the tick was pressed with it, and a press both hid a competition and
    /// lifted it (Julien, build 47). Moving is the row's held press instead.
    private func row(_ league: LeagueSummary, siblings: [String]) -> some View {
        let key = MenuItem.key(league)
        let shown = leagueChoice.isShown(key)
        return Button { leagueChoice.toggle(key) } label: {
            HStack(spacing: .tv(18)) {
                MenuIcon.league(league).view(size: Metrics.menuIcon)
                Text(verbatim: league.menu)
                Spacer()
                if shown { Image(systemName: "checkmark") }
            }
        }
        .accessibilityIdentifier("settings.league.\(key)")
        .accessibilityAddTraits(shown ? .isSelected : [])
        // The menu is the system's own, drawn outside the locale the views
        // are given: its words come from the chosen language's strings.
        .contextMenu {
            Button { leagueChoice.move(key, by: -1, among: siblings) } label: {
                Label(String(localized: "settings.moveUp", bundle: LanguageChoice.bundle), systemImage: "arrow.up")
            }
            .disabled(key == siblings.first)
            Button { leagueChoice.move(key, by: 1, among: siblings) } label: {
                Label(String(localized: "settings.moveDown", bundle: LanguageChoice.bundle), systemImage: "arrow.down")
            }
            .disabled(key == siblings.last)
        }
    }
}

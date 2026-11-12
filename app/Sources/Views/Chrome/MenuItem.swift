import SwiftUI

/// A row of the menu: the television's panel (`Sidebar`), or the list of a
/// phone's or a tablet's split view (`SplitMenu`).
enum MenuItem: Hashable {
    case home
    case league(String)
    /// The gear at the top: opens settings over the page, not a page.
    case settings

    /// What a competition is filed under, in the menu and in Settings'
    /// choices: "football:4328".
    static func key(_ league: LeagueSummary) -> String { "\(league.sport):\(league.id.raw)" }
    static func key(_ ref: LeagueRef) -> String { "\(ref.sport):\(ref.leagueId)" }
}

extension EnvironmentValues {
    /// Opens the menu; a page calls it on Back, as tvOS's sidebar does.
    @Entry var openMenu: @MainActor () -> Void = {}
    /// Opens a game's or a race's page, from its row.
    @Entry var openGame: @MainActor (Event) -> Void = { _ in }
    /// A page reports whether it is scrolled away from its top, for the menu
    /// chip to shrink to its icon, as tvOS's own does.
    @Entry var pageScrolled: @MainActor (Bool) -> Void = { _ in }
    /// Whether the menu is open, read when asked, not when the view was made.
    @Entry var menuIsOpen: @MainActor () -> Bool = { false }
}

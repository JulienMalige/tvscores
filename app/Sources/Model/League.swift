import Foundation

/// A competition as a day's group of games carries it.
struct League: Decodable, Equatable {
    let id: FlexibleID
    /// The proxy's name, in English; `name` says it in the viewer's language.
    fileprivate let given: String
    var name: String { CompetitionName.said(given) }
    let short: String
    let logo: URL?
    /// A system symbol in place of a mark not worth showing (friendlies).
    let symbol: String?
    let color: String?
    let hasStandings: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, given = "name", short, logo, symbol, color, hasStandings
    }
}

/// One entry of the sidebar: a competition, whether or not it is on this week.
struct LeagueSummary: Decodable, Equatable, Identifiable, Hashable {
    let sport: String
    let id: FlexibleID
    fileprivate let given: String
    var name: String { CompetitionName.said(given) }
    /// The name a sidebar row has room for; the full one everywhere else.
    private let givenMenu: String
    var menu: String { CompetitionName.said(givenMenu) }
    let short: String
    let logo: URL?
    /// The same mark as a round icon, for the sidebar.
    let icon: URL?
    /// A system symbol in place of a mark not worth showing (friendlies).
    let symbol: String?
    /// The menu section it goes in when not its sport's own: "international".
    let section: String?
    /// The competition's brand colour ("#37003c"), which tints its page.
    let color: String?
    let hasStandings: Bool
    /// False when nothing of this competition falls inside the week we show.
    let playing: Bool
    /// When it is next on, for a competition with nothing this week.
    let next: NextGame?

    private enum CodingKeys: String, CodingKey {
        case sport, id, given = "name", givenMenu = "menu", short, logo, icon, symbol, section, color, hasStandings, playing, next
    }
}

/// The next fixture of a competition between seasons or in a break.
struct NextGame: Decodable, Equatable, Hashable {
    let start: Date
    let season: String?
    /// The first game of a new season, not the next round of this one.
    let newSeason: Bool?
}

/// Identifies a league page; Hashable so it can be a navigation value.
struct LeagueRef: Hashable {
    let sport: String
    let leagueId: String
    private let given: String
    var name: String { CompetitionName.said(given) }
    let short: String
    let logo: URL?
    let symbol: String?
    let color: String?
    let hasStandings: Bool
    /// Whether anything of it falls inside the week; a page reached from a
    /// group of games is playing by definition.
    let playing: Bool
    let next: NextGame?

    init(_ summary: LeagueSummary) {
        sport = summary.sport
        leagueId = summary.id.raw
        given = summary.given
        short = summary.short
        logo = summary.logo
        symbol = summary.symbol
        color = summary.color
        hasStandings = summary.hasStandings
        playing = summary.playing
        next = summary.next
    }

    init(group: LeagueGroup) {
        sport = group.sport
        leagueId = group.league.id.raw
        given = group.league.given
        short = group.league.short
        logo = group.league.logo
        symbol = group.league.symbol
        color = group.league.color
        hasStandings = group.league.hasStandings ?? false
        playing = true
        next = nil
    }

    func matches(_ group: LeagueGroup) -> Bool {
        group.sport == sport && group.league.id.raw == leagueId
    }
}

/// A competition's name in the viewer's language. Most are brands, said the
/// same everywhere ("Premier League", "Brasileirão"); the few that are plain
/// words arrive from the proxy in English and are found here by those words,
/// the way StatusLabel finds a game's details.
enum CompetitionName {
    static let keys: [String: String] = [
        "International Friendlies": "competition.friendlies",
        "Friendlies": "competition.friendlies.menu",
    ]

    static func said(_ given: String) -> String {
        keys[given].map { String(localized: String.LocalizationValue($0), bundle: LanguageChoice.bundle) } ?? given
    }
}

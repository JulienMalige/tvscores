import Foundation

/// What TV Scores tells Amplitude about how it is used, with the viewer's yes
/// (docs/analytics.md): an event's name and its properties. Pages, games and
/// competitions, never who is watching; and of an app opened from How to
/// Watch, only which one was chosen, never whether it opened — that would
/// say what else is installed, which Apple forbids collecting (5.1.2(iv)).
enum UsageEvent: Equatable {
    /// A page came up: Home, a competition, a game, a race, a page of Settings.
    case pageViewed(Page)
    /// The page went, after so many seconds on it.
    case pageLeft(Page, seconds: Int)
    /// The television's menu panel.
    case menuOpened, menuClosed
    /// From the menu, or from a competition's heading on the front page.
    case competitionOpened(Page, from: String)
    /// A game's or a race's page, from Home or from its competition's page.
    case gameOpened(Page, from: String)
    /// Yesterday, Today or Upcoming, on Home or on a competition's page.
    case dayPicked(Day, on: String)
    case watchAppTapped(app: String, name: String, country: String)
    /// A choice in Settings, before and after: a competition shown or moved,
    /// the countries, an app, the language.
    case settingChanged(setting: String, item: String?, old: String, new: String)
    /// The first board of a launch is on screen, so many seconds after it.
    case boardShown(seconds: Double)
    case boardFailed(reason: String, boardOnScreen: Bool)
    case boardStale
    /// The viewer said yes, to the question or in Settings.
    case sharingStarted(from: String)

    var name: String {
        switch self {
        case .pageViewed: "Page Viewed"
        case .pageLeft: "Page Left"
        case .menuOpened: "Menu Opened"
        case .menuClosed: "Menu Closed"
        case .competitionOpened: "Competition Opened"
        case .gameOpened(let page, _): page.name == "race" ? "Race Opened" : "Game Opened"
        case .dayPicked: "Day Picked"
        case .watchAppTapped: "Watch App Tapped"
        case .settingChanged: "Setting Changed"
        case .boardShown: "Board Shown"
        case .boardFailed: "Board Failed"
        case .boardStale: "Board Stale"
        case .sharingStarted: "Sharing Started"
        }
    }

    var properties: [String: Any] {
        switch self {
        case .pageViewed(let page):
            return page.properties
        case .pageLeft(let page, let seconds):
            var properties: [String: Any] = page.properties
            properties["seconds"] = seconds
            return properties
        case .menuOpened, .menuClosed, .boardStale:
            return [:]
        case .competitionOpened(let page, let from), .gameOpened(let page, let from):
            var properties: [String: Any] = page.properties
            properties["from"] = from
            return properties
        case .dayPicked(let day, let on):
            return ["day": day.rawValue, "on": on]
        case .watchAppTapped(let app, let name, let country):
            return ["app": app, "app_name": name, "country": country]
        case .settingChanged(let setting, let item, let old, let new):
            var properties: [String: Any] = ["setting": setting, "old": old, "new": new]
            properties["item"] = item
            return properties
        case .boardShown(let seconds):
            return ["seconds": (seconds * 10).rounded() / 10]
        case .boardFailed(let reason, let boardOnScreen):
            return ["reason": reason, "board_on_screen": boardOnScreen]
        case .sharingStarted(let from):
            return ["from": from]
        }
    }

    /// A page, by what it shows: its kind, and the competition, game or day.
    struct Page: Equatable {
        let name: String
        let properties: [String: String]

        /// What makes it another page: all it shows but a game's state,
        /// which moves on while the page stays the same (`PageClock`).
        var identity: [String: String] {
            properties.filter { $0.key != "status" }.merging(["page": name]) { kept, _ in kept }
        }

        static func home(_ day: Day) -> Page {
            Page(name: "home", properties: ["day": day.rawValue])
        }

        static func competition(_ ref: LeagueRef, day: Day) -> Page {
            Page(name: "competition", properties: ["competition": ref.givenName, "competition_id": MenuItem.key(ref),
                                                   "sport": ref.sport, "day": day.rawValue])
        }

        /// A game or a race, with its competition when the board still has it.
        static func game(_ event: Event, league: League?) -> Page {
            var properties = ["sport": event.sport, "status": event.status.state.rawValue, "game_id": event.id]
            if let league {
                properties["competition"] = league.givenName
                properties["competition_id"] = "\(event.sport):\(league.id.raw)"
            }
            properties["home"] = event.home?.name
            properties["away"] = event.away?.name
            // A tennis match's tournament; a race weekend's Grand Prix.
            properties["tournament"] = event.competition?.name
            properties["race"] = event.name
            return Page(name: event.kind == .race ? "race" : "game", properties: properties)
        }

        static func settings(_ page: SettingsPage) -> Page {
            Page(name: "settings", properties: ["settings_page": "\(page)"])
        }
    }
}

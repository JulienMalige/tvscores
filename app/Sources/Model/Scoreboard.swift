import Foundation

/// Mirrors the proxy's `/v1/scoreboard` JSON. See proxy/src/model.js.
struct Scoreboard: Decodable, Equatable {
    let generatedAt: Date
    let tz: String
    let stale: [String: Bool]
    let live: Int
    /// Every competition we follow, playing this week or not. The day buckets
    /// only carry what has fixtures, so this is what the menu is built from.
    let leagues: [LeagueSummary]
    let days: Days

    struct Days: Decodable, Equatable {
        let yesterday: [LeagueGroup]
        let today: [LeagueGroup]
        let upcoming: [LeagueGroup]
    }

    func groups(for day: Day) -> [LeagueGroup] {
        switch day {
        case .yesterday: days.yesterday
        case .today: days.today
        case .upcoming: days.upcoming
        }
    }

    var isStale: Bool { stale.values.contains(true) }
}

enum Day: String, CaseIterable, Identifiable {
    case yesterday, today, upcoming
    var id: String { rawValue }
}

struct LeagueGroup: Decodable, Identifiable, Equatable {
    let sport: String
    let league: League
    let events: [Event]
    var id: String { "\(sport):\(league.id.raw)" }
}

struct League: Decodable, Equatable {
    let id: FlexibleID
    let name: String
    let short: String
    let logo: URL?
    /// A system symbol in place of a mark not worth showing (friendlies).
    let symbol: String?
    let color: String?
    let hasStandings: Bool?
}

/// Identifies a league page; Hashable so it can be a navigation value.
/// One entry of the sidebar: a competition, whether or not it is on this week.
struct LeagueSummary: Decodable, Equatable, Identifiable, Hashable {
    let sport: String
    let id: FlexibleID
    let name: String
    /// The name a sidebar row has room for; the full one everywhere else.
    let menu: String
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
}

/// The next fixture of a competition between seasons or in a break.
struct NextGame: Decodable, Equatable, Hashable {
    let start: Date
    let season: String?
    /// The first game of a new season, not the next round of this one.
    let newSeason: Bool?
}

struct LeagueRef: Hashable {
    let sport: String
    let leagueId: String
    let name: String
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
        name = summary.name
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
        name = group.league.name
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

/// League ids are numbers for API-Sports and strings for NBA ("standard") and F1.
struct FlexibleID: Decodable, Hashable {
    let raw: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { raw = String(i) } else { raw = try c.decode(String.self) }
    }
}

/// Hashable by identity so a row can be a navigation value.
extension Event: Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct Event: Decodable, Identifiable, Equatable {
    let id: String
    let sport: String
    let kind: Kind
    let start: Date
    let round: String?
    let status: Status
    // match
    let home: TeamRef?
    let away: TeamRef?
    let score: Score?
    /// The tournament a tennis match belongs to.
    let competition: Competition?
    /// Each side's record from its table, for a game to come: "1-2".
    let records: GameDetail.Records?
    /// The channels it is on in the proxy's country: "Canal+", "beIN Sports 1".
    let broadcasts: [String]?
    /// The same by country, "FR", "US", "BR"; `broadcasts` is France's,
    /// kept for builds before 36.
    let broadcastsBy: [String: [String]]?
    // race
    let name: String?
    let circuit: String?
    let country: String?
    /// The country's flag, for a race.
    let flag: String?
    /// The weekend's timetable — qualifying, sprint, race — for a race.
    let sessions: [Session]?
    let results: [RaceResult]?
    /// Qualifying and the sprint once each is classified, before the race is.
    let sessionResults: [SessionResult]?

    enum Kind: String, Decodable, Equatable { case match, race }
}

struct Status: Decodable, Equatable {
    let state: State
    let clock: String?
    let detail: String?
    /// Short English token from the proxy (e.g. "Interrupted"), localised by the app.
    let note: String?

    enum State: String, Decodable, Equatable {
        case scheduled, live, final, other
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = State(rawValue: raw) ?? .other
        }
    }
}

struct TeamRef: Decodable, Equatable {
    let name: String
    let short: String
    let nick: String?
    let logo: URL?
    let photo: URL?
    let flag: String?
    /// What the row shows under the badge: nickname for US teams, club name otherwise.
    var label: String { nick ?? name }
}

struct Score: Decodable, Equatable {
    let home: Int?
    let away: Int?
    /// Tennis: the games of each set, [home, away] — [[6, 2], [6, 3]].
    let sets: [[Int]]?
    /// Tennis: "home" or "away", from the feed — a player who retires can
    /// be ahead on sets and still lose.
    let winner: String?
}

struct RaceResult: Decodable, Identifiable, Equatable {
    /// Missing for a driver who did not finish: there is no position to show.
    let pos: Int?
    let driver: String
    let code: String?
    let nationality: String?
    let flag: String?
    let team: String?
    let teamColor: String?
    let gap: String?
    /// A qualifying lap: "1:35.130". Absent from a race or a sprint.
    let time: String?
    let photo: URL?
    let grid: Int?
    let points: Int?
    let laps: Int?
    let fastestLap: Bool?
    var id: String { "\(pos.map { String($0) } ?? "-")-\(driver)" }
    var finished: Bool { pos != nil }
}

enum ScoreboardDecoder {
    static func make() -> JSONDecoder {
        let d = JSONDecoder()
        let withFrac = ISO8601DateFormatter()
        withFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = withFrac.date(from: s) ?? plain.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "bad date \(s)"))
        }
        return d
    }
}

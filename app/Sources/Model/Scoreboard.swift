import Foundation

/// Mirrors the proxy's `/v1/scoreboard` JSON. See proxy/src/model.js.
struct Scoreboard: Decodable {
    let generatedAt: Date
    let tz: String
    let stale: [String: Bool]
    let live: Int
    let days: Days

    struct Days: Decodable {
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

struct LeagueGroup: Decodable, Identifiable {
    let sport: String
    let league: League
    let events: [Event]
    var id: String { "\(sport):\(league.id.raw)" }
}

struct League: Decodable {
    let id: FlexibleID
    let name: String
    let short: String
}

/// League ids are numbers for API-Sports and strings for NBA ("standard") and F1.
struct FlexibleID: Decodable, Hashable {
    let raw: String
    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { raw = String(i) } else { raw = try c.decode(String.self) }
    }
}

struct Event: Decodable, Identifiable {
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
    // race
    let name: String?
    let circuit: String?
    let country: String?
    let results: [RaceResult]?

    enum Kind: String, Decodable { case match, race }
}

struct Status: Decodable {
    let state: State
    let clock: String?
    let detail: String?

    enum State: String, Decodable {
        case scheduled, live, final, other
        init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = State(rawValue: raw) ?? .other
        }
    }
}

struct TeamRef: Decodable {
    let name: String
    let short: String
    let nick: String?
    /// What the row shows under the badge: nickname for US teams, club name otherwise.
    var label: String { nick ?? name }
}

struct Score: Decodable {
    let home: Int?
    let away: Int?
}

struct RaceResult: Decodable, Identifiable {
    let pos: Int
    let driver: String
    let code: String?
    let nationality: String?
    let team: String?
    let gap: String?
    var id: Int { pos }
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

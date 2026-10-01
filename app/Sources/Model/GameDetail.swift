import Foundation

/// One game's page as the proxy serves it (`/v1/event?id=`): the score by
/// period, a trimmed set of statistics, goals and cards, the venue, and each
/// team's record from its table. Football, NFL and NBA; every part optional,
/// since each sport's feed carries a different share of them.
struct GameDetail: Decodable, Equatable {
    let venue: String?
    let city: String?
    let periods: Periods?
    let stats: [Stat]
    let timeline: [Moment]
    let records: Records?

    struct Periods: Decodable, Equatable {
        let labels: [String]
        let home: [Int]
        let away: [Int]
    }

    struct Stat: Decodable, Equatable, Identifiable {
        /// possession, shots, shotsOnTarget, … — named in the catalogue as `stat.<id>`.
        let id: String
        let home: Double
        let away: Double

        /// Shown with a percent sign.
        var isPercent: Bool { id == "possession" || id.hasSuffix("Pct") }
    }

    /// A goal or a card, and on whose side.
    struct Moment: Decodable, Equatable {
        let minute: Int
        let side: String
        /// goal | penalty | ownGoal | yellow | red
        let kind: String
        let player: String?

        var isHome: Bool { side == "home" }
    }

    struct Records: Decodable, Equatable {
        let home: String?
        let away: String?
    }
}

extension Scoreboard {
    /// An event wherever it sits in the three days, and the group it sits in.
    func find(_ id: String) -> (event: Event, group: LeagueGroup)? {
        for day in Day.allCases {
            for group in groups(for: day) {
                if let hit = group.events.first(where: { $0.id == id }) { return (hit, group) }
            }
        }
        return nil
    }
}

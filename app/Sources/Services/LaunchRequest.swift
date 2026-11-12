import Foundation

/// What a launch argument asks the app to open first: the flows and the CI's
/// screenshots name a day (`-TVScoresTab`), a game (`-TVScoresGame`) or a
/// race (`-TVScoresRace`).
///
/// Choices split by "|" are tried in turn. The store's screenshots run on live
/// data (`store-shots.yml`), so they name the best game first and what will do
/// when it is not on: "scheduled:nfl:tv|scheduled:football:tv".
@MainActor
enum LaunchRequest {
    /// What follows a launch argument; "" for one given alone, nil when absent.
    static func argument(_ name: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: name), i + 1 < args.count { return args[i + 1] }
        return args.contains(name) ? "" : nil
    }

    /// `-TVScoresTab upcoming` picks the first day shown (CI screenshots).
    static func initialDay() -> Day {
        guard let raw = argument("-TVScoresTab"), let day = Day(rawValue: raw) else { return .today }
        return day
    }

    /// "final" or "final:football": a state, and the sport to take it from;
    /// then "tv", a game with channels, or a competition's id, a game of that
    /// competition: "scheduled:nfl:tv", "final:football:4328".
    static func game(_ wanted: String, in board: Scoreboard) -> Event? {
        let games = Day.allCases.flatMap { board.groups(for: $0) }
            .flatMap { group in group.events.map { (league: group.league.id.raw, event: $0) } }
        for choice in wanted.split(separator: "|") {
            let parts = choice.split(separator: ":").map(String.init)
            let hit = games.first { g in
                g.event.kind == .match && g.event.status.state.rawValue == parts.first
                    && (parts.count < 2 || g.event.sport == parts[1])
                    && parts.dropFirst(2).allSatisfy { $0 == "tv" ? g.event.channelList != nil : g.league == $0 }
            }
            if let hit { return hit.event }
        }
        return nil
    }

    /// "f1": the series' weekend with a result; "f1:next", its next weekend,
    /// not yet run; "f1:grid", one whose qualifying is run and race is not.
    static func race(_ wanted: String, in board: Scoreboard) -> Event? {
        for choice in wanted.split(separator: "|") {
            let parts = choice.split(separator: ":").map(String.init)
            guard let series = parts.first else { continue }
            let races = Day.allCases.flatMap { board.groups(for: $0) }
                .filter { $0.sport == series }
                .flatMap(\.events)
            let race: Event? = switch parts.count > 1 ? parts[1] : "" {
            case "next": races.first { $0.status.state == .scheduled }
            case "grid": races.first { $0.startingGrid != nil && ($0.results ?? []).isEmpty }
            default: races.first { !($0.results ?? []).isEmpty }
            }
            if let race { return race }
        }
        return nil
    }
}

import Foundation

/// One session of a race weekend: qualifying, the sprint, the race.
struct Session: Decodable, Equatable, Identifiable {
    let kind: String   // qualifying | sprint | race, or whatever the feed calls it
    let name: String
    let start: Date
    var id: String { "\(kind)-\(start.timeIntervalSince1970)" }
}

/// A qualifying or a sprint once it is classified, ahead of the race. For
/// qualifying the rows are the grid, each with its lap as `time`; for a
/// sprint they read as a race's do. MotoGP's Q1 and Q2 come as one
/// qualifying, listed at Q2's start.
struct SessionResult: Decodable, Equatable, Identifiable {
    let kind: String
    let name: String
    let start: Date
    let results: [RaceResult]
    var id: String { "\(kind)-\(start.timeIntervalSince1970)" }
    var session: Session { Session(kind: kind, name: name, start: start) }
}

extension Event {
    /// The weekend's sessions that fall on a day bucket, measured from `now`
    /// in the viewer's calendar: yesterday's, today's, or for Upcoming every
    /// one from tomorrow on.
    func sessions(on day: Day, now: Date = .now, calendar: Calendar = .current) -> [Session] {
        guard let sessions else { return [] }
        switch day {
        case .today:
            return sessions.filter { calendar.isDate($0.start, inSameDayAs: now) }
        case .yesterday:
            let reference = calendar.date(byAdding: .day, value: -1, to: now) ?? now
            return sessions.filter { calendar.isDate($0.start, inSameDayAs: reference) }
        case .upcoming:
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
            return sessions.filter { $0.start >= tomorrow }
        }
    }

    /// The latest qualifying or sprint classified on a day bucket, which a
    /// row shows in place of the race's podium on that day.
    func latestSessionResult(on day: Day, now: Date = .now, calendar: Calendar = .current) -> SessionResult? {
        guard day != .upcoming else { return nil }
        let reference = day == .today ? now : (calendar.date(byAdding: .day, value: -1, to: now) ?? now)
        return (sessionResults ?? [])
            .filter { !$0.results.isEmpty && calendar.isDate($0.start, inSameDayAs: reference) }
            .max { $0.start < $1.start }
    }

    /// The grid from qualifying, once it is run.
    var startingGrid: [RaceResult]? { classified("qualifying") }

    /// The sprint's classification, on a weekend that has one.
    var sprintResults: [RaceResult]? { classified("sprint") }

    private func classified(_ kind: String) -> [RaceResult]? {
        guard let rows = sessionResults?.first(where: { $0.kind == kind })?.results, !rows.isEmpty else { return nil }
        return rows
    }
}

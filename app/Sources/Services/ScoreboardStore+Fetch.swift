import Foundation
import UIKit

/// What the store asks the proxy for: the board, one game's page, a competition's table.
/// (Kept apart from the store's state and its picture warming, which are long enough.)
extension ScoreboardStore {
    /// The kind of device asking (tv, phone or pad), for the server's daily
    /// totals (docs/analytics.md): what it is, never who.
    static let platform = UsageProfile.platform(UIDevice.current.userInterfaceIdiom)

    /// A request to the proxy, with its time-out and the kind of device.
    static func request(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue(platform, forHTTPHeaderField: "X-TVScores-Platform")
        return request
    }

    /// One game's page from the proxy, or nil: the bundled demo has none,
    /// and a race, a tennis match or a failed request has none either.
    func detail(for eventId: String) async -> GameDetail? {
        guard case .remote(let base) = source,
              var comps = URLComponents(url: base.appending(path: "v1/event"), resolvingAgainstBaseURL: false)
        else { return nil }
        comps.queryItems = [URLQueryItem(name: "id", value: eventId)]
        guard let url = comps.url else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(for: Self.request(url))
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            return try ScoreboardDecoder.make().decode(GameDetail.self, from: data)
        } catch {
            return nil
        }
    }

    /// Standings for one league, or nil when the proxy has none (free-plan sports).
    func standings(for ref: LeagueRef) async -> Standings? {
        do {
            switch source {
            case .bundled:
                guard let url = Bundle.main.url(forResource: "sample-standings", withExtension: "json") else { return nil }
                let bundle = try ScoreboardDecoder.make().decode(StandingsBundle.self, from: Data(contentsOf: url))
                return bundle.standings["\(ref.sport):\(ref.leagueId)"]
            case .remote(let base):
                let req = Self.request(base.appending(path: "v1/standings/\(ref.sport)/\(ref.leagueId)"))
                let (d, resp) = try await URLSession.shared.data(for: req)
                guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else { return nil }
                return try ScoreboardDecoder.make().decode(Standings.self, from: d)
            }
        } catch {
            return nil
        }
    }

    /// The board's address: the viewer's time zone, and the sports this build
    /// can show and hide. The proxy holds back any other, which is how a build
    /// up to 1.0, naming none, never sees rugby.
    nonisolated static func boardURL(_ base: URL, zone: TimeZone = .current) -> URL {
        base.appending(path: "v1/scoreboard").appending(queryItems: [
            URLQueryItem(name: "tz", value: zone.identifier),
            URLQueryItem(name: "sports", value: SportSection.sports.joined(separator: ",")),
        ])
    }

    func load() async throws -> Scoreboard {
        let data: Data
        switch source {
        case .bundled(let name):
            guard let url = Bundle.main.url(forResource: name, withExtension: "json") else {
                throw URLError(.fileDoesNotExist)
            }
            data = try Data(contentsOf: url)
        case .remote(let base):
            let (d, resp) = try await URLSession.shared.data(for: Self.request(Self.boardURL(base)))
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw URLError(.badServerResponse)
            }
            data = d
        }
        return try ScoreboardDecoder.make().decode(Scoreboard.self, from: data)
    }
}

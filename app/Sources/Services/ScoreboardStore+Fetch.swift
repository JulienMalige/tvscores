import Foundation

/// What the store asks the proxy for: the board, one game's page, a competition's table.
/// (Kept apart from the store's state and its picture warming, which are long enough.)
extension ScoreboardStore {
    /// One game's page from the proxy, or nil: the bundled demo has none,
    /// and a race, a tennis match or a failed request has none either.
    func detail(for eventId: String) async -> GameDetail? {
        guard case .remote(let base) = source,
              var comps = URLComponents(url: base.appending(path: "v1/event"), resolvingAgainstBaseURL: false)
        else { return nil }
        comps.queryItems = [URLQueryItem(name: "id", value: eventId)]
        guard let url = comps.url else { return nil }
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
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
                var req = URLRequest(url: base.appending(path: "v1/standings/\(ref.sport)/\(ref.leagueId)"))
                req.timeoutInterval = 15
                let (d, resp) = try await URLSession.shared.data(for: req)
                guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else { return nil }
                return try ScoreboardDecoder.make().decode(Standings.self, from: d)
            }
        } catch {
            return nil
        }
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
            var comps = URLComponents(url: base.appending(path: "v1/scoreboard"), resolvingAgainstBaseURL: false)!
            comps.queryItems = [URLQueryItem(name: "tz", value: TimeZone.current.identifier)]
            var req = URLRequest(url: comps.url!)
            req.timeoutInterval = 15
            let (d, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw URLError(.badServerResponse)
            }
            data = d
        }
        return try ScoreboardDecoder.make().decode(Scoreboard.self, from: data)
    }
}

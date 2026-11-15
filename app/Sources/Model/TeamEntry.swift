import Foundation

/// One side that can be followed, as `/v1/teams` lists it (proxy/src/teams.js):
/// a club, a national team, a driver, a rider or a player.
struct TeamEntry: Decodable, Identifiable, Hashable {
    let key: String
    let name: String
    let logo: URL?
    let photo: URL?
    let flag: String?
    var id: String { key }

    /// Its monogram when there is no picture: "PSG" from "Paris Saint-Germain" would
    /// need the proxy's table of codes, so the first three letters do.
    var monogram: String { String(name.filter(\.isLetter).prefix(3)).uppercased() }
}

/// `/v1/teams`: each competition's sides, by "sport:league".
struct TeamsList: Decodable {
    let teams: [String: [TeamEntry]]
}

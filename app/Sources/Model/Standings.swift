import Foundation

/// Mirrors the proxy's `/v1/standings/{sport}/{league}` JSON: one or more
/// tables — drivers and constructors, the two conferences, a league's one
/// table — each read either as a list of people with a number beside them
/// or as columns of numbers with the places cut into zones.
struct Standings: Decodable {
    let updatedAt: Date
    let tables: [StandingsTable]
}

struct StandingsTable: Decodable, Identifiable {
    let id: String   // drivers | constructors | teams | rankings | table | AFC | NFC | east | west
    let rows: [StandingsEntry]
    /// Column ids the rows' `cells` line up with ("p", "w", "pts"...), for the
    /// tables that are read as columns; a table of people has none.
    let columns: [String]?
    /// Where the table is cut: a line after the given row, solid or dashed.
    let lines: [TableLine]?
    /// What the places mean, listed under the table.
    let legend: [TableZone]?
}

struct TableLine: Decodable, Equatable {
    let after: Int
    let line: String
}

struct TableZone: Decodable, Equatable {
    let from: Int
    let to: Int
    let key: String
}

struct StandingsEntry: Decodable, Identifiable {
    let pos: Int
    let name: String
    let sub: String?
    let value: Int?
    let extra: String?
    let code: String?
    let color: String?
    let flag: String?
    let photo: URL?
    /// Constructor or team badge; a table of marques, not of people.
    let logo: URL?
    /// The row's numbers, one per column of the table.
    let cells: [String]?
    /// The division this row sits in, for a table read division by division.
    let section: String?
    var id: String { "\(section ?? "")-\(pos)-\(name)" }
}

/// Bundled demo file: { "standings": { "sport:league": Standings } }
struct StandingsBundle: Decodable {
    let standings: [String: Standings]
}


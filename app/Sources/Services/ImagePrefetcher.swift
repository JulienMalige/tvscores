import Foundation

/// Decodes every crest, badge and portrait in a board before a row asks for it.
///
/// A row only starts loading its image when it appears, and shows the fallback
/// monogram until then, so a list that has just arrived looks like it is
/// missing its logos. Warming `ImageCache` as soon as the board lands means the
/// first draw already has the picture — the bytes are not enough on their own,
/// because the decode is the part that happens after the row is on screen.
actor ImagePrefetcher {
    static let shared = ImagePrefetcher()

    private var done: Set<URL> = []
    private let parallel = 4

    /// Returns how many of the pictures asked for are now in memory. Only a
    /// picture that arrived is remembered as done: one that failed on a cold
    /// line is asked for again next time, which is how the menu's icons fill
    /// in after a slow start.
    @discardableResult
    func prefetch(_ urls: [URL?]) async -> Int {
        let wanted = Array(Set(urls.compactMap { $0 })).filter { !done.contains($0) }
        guard !wanted.isEmpty else { return urls.compactMap { $0 }.count }
        // A few at a time: an Apple TV on a slow line should not open sixty
        // connections at once, and the visible rows matter more than the tail.
        for chunk in stride(from: 0, to: wanted.count, by: parallel).map({
            Array(wanted[$0..<min($0 + parallel, wanted.count)])
        }) {
            let arrived = await withTaskGroup(of: URL?.self, returning: [URL].self) { group in
                for url in chunk {
                    group.addTask { await ImageCache.shared.load(url) == nil ? nil : url }
                }
                var out: [URL] = []
                for await hit in group { if let hit { out.append(hit) } }
                return out
            }
            done.formUnion(arrived)
        }
        return urls.compactMap { $0 }.filter { done.contains($0) }.count
    }
}

extension Scoreboard {
    /// Every image the board can show, league marks first: those head each
    /// section and are what the eye lands on while scrolling.
    var imageURLs: [URL?] {
        let groups = Day.allCases.flatMap { self.groups(for: $0) }
        var marks: [URL?] = leagues.flatMap { [$0.logo, $0.icon] }
        var rest: [URL?] = []
        for group in groups {
            marks.append(group.league.logo)
            for event in group.events {
                rest.append(event.home?.logo)
                rest.append(event.home?.photo)
                rest.append(Flags.icon(for: event.home?.flag))
                rest.append(event.away?.logo)
                rest.append(event.away?.photo)
                rest.append(Flags.icon(for: event.away?.flag))
                rest.append(Flags.icon(for: event.flag))
                for row in event.results ?? [] {
                    rest.append(row.photo)
                    rest.append(Flags.icon(for: row.flag))
                }
            }
        }
        return marks + rest
    }
}

extension Standings {
    /// A league table's portraits and badges, warmed when the table lands so
    /// that switching between drivers and teams draws them straight away.
    var imageURLs: [URL?] {
        tables.flatMap { $0.rows.flatMap { [$0.photo, $0.logo, Flags.icon(for: $0.flag)] } }
    }
}

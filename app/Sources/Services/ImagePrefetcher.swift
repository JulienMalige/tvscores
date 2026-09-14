import Foundation

/// Warms the shared URL cache with every crest, badge and portrait in a board.
///
/// `AsyncImage` only starts downloading when its row scrolls into view, and it
/// shows the fallback monogram until the bytes arrive, so a list that has just
/// appeared looks like it is missing its logos. Fetching them as soon as the
/// board lands means the cache answers those requests immediately.
actor ImagePrefetcher {
    static let shared = ImagePrefetcher()

    private var done: Set<URL> = []
    private let session: URLSession
    private let parallel = 4

    init(session: URLSession = .shared) {
        self.session = session
    }

    func prefetch(_ urls: [URL?]) async {
        let wanted = urls.compactMap { $0 }.filter { !done.contains($0) }
        guard !wanted.isEmpty else { return }
        done.formUnion(wanted)
        // A few at a time: an Apple TV on a slow line should not open sixty
        // connections at once, and the visible rows matter more than the tail.
        for chunk in stride(from: 0, to: wanted.count, by: parallel).map({
            Array(wanted[$0..<min($0 + parallel, wanted.count)])
        }) {
            await withTaskGroup(of: Void.self) { group in
                for url in chunk {
                    group.addTask { [session] in
                        var req = URLRequest(url: url)
                        req.timeoutInterval = 20
                        req.cachePolicy = .returnCacheDataElseLoad
                        _ = try? await session.data(for: req)
                    }
                }
            }
        }
    }

    /// Forget what has been fetched, so a later board can warm the cache again.
    func reset() {
        done.removeAll()
    }
}

extension Scoreboard {
    /// Every image the board can show, league marks first: those head each
    /// section and are what the eye lands on while scrolling.
    var imageURLs: [URL?] {
        let groups = Day.allCases.flatMap { self.groups(for: $0) }
        var marks: [URL?] = []
        var rest: [URL?] = []
        for group in groups {
            marks.append(group.league.logo)
            for event in group.events {
                rest.append(event.home?.logo)
                rest.append(event.home?.photo)
                rest.append(event.away?.logo)
                rest.append(event.away?.photo)
                for row in event.results ?? [] { rest.append(row.photo) }
            }
        }
        return marks + rest
    }
}

import Foundation
import Observation

/// Where the scoreboard comes from. `-TVScoresDemo` in the launch arguments
/// switches to the bundled sample so CI screenshots and previews never hit the network.
enum ScoreboardSource {
    case remote(URL)
    /// A board from the bundle. `-TVScoresSample race` picks `sample-race.json`
    /// — a week that holds a classified race, whatever this week's calendar
    /// holds — and the default is the board the screenshots use.
    case bundled(String = "sample-scoreboard")

    static func resolve() -> ScoreboardSource {
        let args = ProcessInfo.processInfo.arguments
        let sample = args.firstIndex(of: "-TVScoresSample").flatMap { args.indices.contains($0 + 1) ? "sample-\(args[$0 + 1])" : nil }
        if args.contains("-TVScoresDemo") { return .bundled(sample ?? "sample-scoreboard") }
        // The app hosting a unit-test run is not a user: no proxy, no network.
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil { return .bundled() }
        if let s = Bundle.main.object(forInfoDictionaryKey: "TVScoresProxyURL") as? String, let url = URL(string: s) {
            return .remote(url)
        }
        return .bundled()
    }
}

@MainActor
@Observable
final class ScoreboardStore {
    private(set) var board: Scoreboard?
    /// The competitions, held apart from the board and replaced only when the
    /// list itself changes.
    ///
    /// The board is replaced every time a score moves — twice a minute while
    /// a game is on — and the sidebar is built from this. Handing it a fresh
    /// array that often rebuilds the menu under whoever is reading it.
    private(set) var leagues: [LeagueSummary] = []
    private(set) var error: String?
    private(set) var loading = false
    /// False until the first board has arrived *and* its competition marks are
    /// decoded. The app shows a loader until then, because a screen drawn
    /// before its pictures shows fallbacks and then swaps them — which reads
    /// as a glitch rather than as loading.
    private(set) var ready = false
    let source: ScoreboardSource
    /// Whether a board's pictures are decoded ahead of the screen. A test of
    /// the model has no screen and no wish to fetch three hundred crests.
    private let warmsImages: Bool
    private var task: Task<Void, Never>?

    init(source: ScoreboardSource = .resolve(), warmImages: Bool = true) {
        self.source = source
        self.warmsImages = warmImages
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let fresh = try await load()
            if fresh != board { board = fresh } // avoid re-rendering an unchanged board
            if fresh.leagues != leagues { leagues = fresh.leagues }
            error = nil
            if warmsImages { await warm(fresh) } else { ready = true }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Decode the pictures before the screen wants them.
    ///
    /// The marks go first and are waited for: there are a dozen or so, they
    /// head every section and fill the sidebar, and a second of loader beats a
    /// sidebar full of soccerballs that turn into badges. Everything else — a
    /// few hundred crests and portraits — carries on behind the screen.
    private func warm(_ board: Scoreboard) async {
        let marks = board.leagues.map(\.logo)
        if !ready {
            // A slow line must not hold the app shut: show what we have after
            // this long whether the marks arrived or not.
            await withTaskGroup(of: Void.self) { group in
                group.addTask { await ImagePrefetcher.shared.prefetch(marks) }
                group.addTask { try? await Task.sleep(for: .seconds(4)) }
                await group.next()
                group.cancelAll()
            }
            ready = true
        }
        let rest = board.imageURLs
        Task.detached(priority: .utility) { await ImagePrefetcher.shared.prefetch(rest) }
    }

    /// Every 30 s while a game is on, every 3 min otherwise. Idempotent.
    ///
    /// A score reaches the television through three waits — the provider's
    /// feed moves every 60 s, the proxy polls it, and this polls the proxy —
    /// and they add up. Asking more often costs almost nothing now that an
    /// unchanged board comes back as a 304 with no body.
    func startAutoRefresh() {
        guard task == nil else { return }
        task = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                let live = (self?.board?.live ?? 0) > 0
                try? await Task.sleep(for: .seconds(live ? 30 : 180))
            }
        }
    }

    func stopAutoRefresh() {
        task?.cancel()
        task = nil
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

    private func load() async throws -> Scoreboard {
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

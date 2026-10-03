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
    /// How far the launch is, 0 to 1, for the loader's bar: asking, then the
    /// board in, then the menu's icons as they arrive. It only moves forward
    /// and stops mattering once `ready`.
    private(set) var launchProgress = Self.asking
    private static let asking = 0.05, boardIn = 0.35
    /// Moves when the menu's icons have arrived — once after launch, and
    /// again if a retry brings in one that a slow line lost. The sidebar
    /// rows are drawn from the image cache without state of their own, so
    /// this is what tells them to look again; it changes a handful of times
    /// in a session, never while a picture is in flight.
    private(set) var iconsVersion = 0
    let source: ScoreboardSource
    /// Whether a board's pictures are decoded ahead of the screen. A test of
    /// the model has no screen and no wish to fetch three hundred crests.
    private let warmsImages: Bool
    /// What decodes them, answering how many are in; a test hands in its own.
    private let prefetch: ([URL?]) async -> Int
    private var task: Task<Void, Never>?

    init(source: ScoreboardSource = .resolve(), warmImages: Bool = true,
         prefetch: @escaping ([URL?]) async -> Int = { await ImagePrefetcher.shared.prefetch($0) }) {
        self.source = source
        self.warmsImages = warmImages
        self.prefetch = prefetch
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let fresh = try await load()
            let boardMoved = fresh != board, menuMoved = fresh.leagues != leagues
            if boardMoved { board = fresh } // avoid re-rendering an unchanged board
            if menuMoved { leagues = fresh.leagues }
            if boardMoved || menuMoved { Diagnostics.shared.note("refresh: board \(boardMoved ? "changed" : "same"), menu \(menuMoved ? "changed" : "same"), live \(fresh.live)") }
            error = nil
            advance(to: Self.boardIn)
            if warmsImages { await warm(fresh) } else { ready = true }
        } catch {
            self.error = error.localizedDescription
            Diagnostics.shared.note("refresh failed: \(error.localizedDescription)")
        }
    }

    /// How long to wait before asking again. Until the first board is in,
    /// seconds — a television's wifi wakes late and the first request after
    /// it fails, and three minutes of loader for that read as an app that
    /// hangs. Once a board is up, the poll: 30 s while a game is on, 3 min
    /// otherwise.
    nonisolated static func retryDelay(ready: Bool, live: Bool, failures: Int) -> Duration {
        guard ready else { return .seconds(min(3 << min(failures, 4), 30)) }
        return .seconds(live ? 30 : 180)
    }

    /// Decode the pictures before the screen wants them.
    ///
    /// The menu's icons go first, then today's crests and portraits (Julien,
    /// 2026-10-03), and both are waited for: there are fifteen icons, they are
    /// the smallest files, and a second of loader beats a menu full of
    /// soccerballs or a front page whose crests pop in. A slow line must not
    /// hold the app shut, so the wait has a ceiling; whatever is still missing
    /// after it keeps loading behind the screen, and `iconsVersion` moves when
    /// the icons land so the menu redraws. Everything else — the other days'
    /// crests and portraits — carries on behind.
    private func warm(_ board: Scoreboard) async {
        let icons = board.leagues.map(\.icon)
        let waited = icons + board.todayImageURLs
        if !ready {
            await withTaskGroup(of: Void.self) { group in
                group.addTask { [prefetch, weak self] in
                    // As many at a time as the prefetcher takes, so the bar moves as they land.
                    let step = ImagePrefetcher.parallel
                    let chunks = stride(from: 0, to: waited.count, by: step).map { Array(waited[$0..<min($0 + step, waited.count)]) }
                    for (i, chunk) in chunks.enumerated() {
                        _ = await prefetch(chunk)
                        await self?.iconsLanded(Double(i + 1) / Double(chunks.count))
                    }
                }
                group.addTask { try? await Task.sleep(for: .seconds(6)) }
                await group.next()
                group.cancelAll()
            }
            ready = true
            launchProgress = 1
        }
        let rest = board.imageURLs
        Task.detached(priority: .utility) { [prefetch] in _ = await prefetch(rest) }
        // Behind the screen, so a refresh is never held up by a slow icon;
        // one filler at a time, so refreshes do not stack them.
        guard !fillingIcons else { return }
        fillingIcons = true
        Task { [weak self] in
            await self?.fillIcons(icons)
            self?.fillingIcons = false
        }
    }

    private func advance(to value: Double) { launchProgress = max(launchProgress, value) }

    /// The icons and today's pictures are the rest of the way from the board's arrival to ready.
    private func iconsLanded(_ fraction: Double) { advance(to: Self.boardIn + (1 - Self.boardIn) * fraction) }

    private var iconsHave = 0
    private var fillingIcons = false

    /// The icons that missed the ceiling, or failed on a cold line: asked for
    /// again, a little later each time, until they are all in or we give up.
    /// The version moves only when more of them are in than before, so a
    /// refresh that finds nothing new redraws nothing.
    private func fillIcons(_ icons: [URL?]) async {
        let wanted = icons.compactMap { $0 }.count
        for attempt in 0..<5 {
            let have = await prefetch(icons)
            if have > iconsHave {
                iconsHave = have
                iconsVersion += 1
            }
            if have >= wanted { return }
            try? await Task.sleep(for: .seconds(15 << attempt))
        }
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
            var failures = 0
            while !Task.isCancelled {
                await self?.refresh()
                failures = self?.error == nil ? 0 : failures + 1
                let live = (self?.board?.live ?? 0) > 0
                try? await Task.sleep(for: Self.retryDelay(ready: self?.ready ?? false, live: live, failures: failures))
            }
        }
    }

    func stopAutoRefresh() {
        task?.cancel()
        task = nil
    }

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

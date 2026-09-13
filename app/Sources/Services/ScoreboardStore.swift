import Foundation
import Observation

/// Where the scoreboard comes from. `-TVScoresDemo` in the launch arguments
/// switches to the bundled sample so CI screenshots and previews never hit the network.
enum ScoreboardSource {
    case remote(URL)
    case bundled

    static func resolve() -> ScoreboardSource {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-TVScoresDemo") { return .bundled }
        if let s = Bundle.main.object(forInfoDictionaryKey: "TVScoresProxyURL") as? String, let url = URL(string: s) {
            return .remote(url)
        }
        return .bundled
    }
}

@MainActor
@Observable
final class ScoreboardStore {
    private(set) var board: Scoreboard?
    private(set) var error: String?
    private(set) var loading = false
    let source: ScoreboardSource
    private var task: Task<Void, Never>?

    init(source: ScoreboardSource = .resolve()) {
        self.source = source
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            board = try await load()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Poll every 30 s while something is live, every 2 min otherwise. Idempotent.
    func startAutoRefresh() {
        guard task == nil else { return }
        task = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                let live = (self?.board?.live ?? 0) > 0
                try? await Task.sleep(for: .seconds(live ? 30 : 120))
            }
        }
    }

    func stopAutoRefresh() {
        task?.cancel()
        task = nil
    }

    private func load() async throws -> Scoreboard {
        let data: Data
        switch source {
        case .bundled:
            guard let url = Bundle.main.url(forResource: "sample-scoreboard", withExtension: "json") else {
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

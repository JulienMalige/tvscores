import Foundation

/// An app a game can be watched in, as the proxy describes it in the board's
/// `apps` (see proxy/src/watch.js): its name, what it is to the channel, how to
/// find it in the App Store and the links to try on this Apple TV.
struct WatchApp: Decodable, Equatable {
    let name: String
    /// "own" (the channel's own app), "streamer" or "provider" (carries many channels).
    let kind: String
    let id: StoreID?
    /// The Apple TV app, which is not in the store.
    let builtIn: Bool?
    /// URL schemes to try, in order, before the store page.
    let schemes: [String]?
    let icon: URL?

    /// The App Store id: one number, or one per country where the listing differs.
    enum StoreID: Decodable, Equatable {
        case one(Int)
        case byCountry([String: Int])

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let n = try? c.decode(Int.self) { self = .one(n) } else { self = .byCountry(try c.decode([String: Int].self)) }
        }

        func value(for country: String) -> Int? {
            switch self {
            case .one(let n): n
            case .byCountry(let map): map[country] ?? map.values.first
            }
        }
    }
}

/// One card of a game's How to Watch: an app, in the country whose channel put it there.
struct WatchCard: Identifiable, Equatable {
    let key: String
    let country: String
    let app: WatchApp
    var id: String { "\(country):\(key)" }
}

extension Event {
    /// The apps that can show this game, in the countries chosen in Settings, in the
    /// order the proxy gave them, each once.
    @MainActor
    func watchCards(_ apps: [String: WatchApp]?, in chosen: [String]? = nil) -> [WatchCard] {
        guard let apps, let watchOn else { return [] }
        var seen = Set<String>()
        return (chosen ?? ChannelChoice.shared.countries).flatMap { country in
            (watchOn[country] ?? []).compactMap { key -> WatchCard? in
                guard let app = apps[key], seen.insert(key).inserted else { return nil }
                return WatchCard(key: key, country: country, app: app)
            }
        }
    }
}

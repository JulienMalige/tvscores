import Foundation
import Observation

/// Which competitions the viewer wants, and in what order (Settings,
/// Julien, build 36). Hidden ones leave the menu and Home; the order is the
/// menu's within each family, and Home's. Kept on this Apple TV; the proxy
/// still serves everything. Keys are "sport:league", as the menu's.
@MainActor
@Observable
final class LeagueChoice {
    static let shared = LeagueChoice()
    private static let hiddenKey = "hiddenLeagues"
    private static let orderKey = "leagueOrder"

    private(set) var hidden: Set<String>
    private(set) var order: [String]
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hidden = Set(defaults.stringArray(forKey: Self.hiddenKey) ?? [])
        order = defaults.stringArray(forKey: Self.orderKey) ?? []
    }

    func isShown(_ key: String) -> Bool { !hidden.contains(key) }

    func toggle(_ key: String) {
        if hidden.contains(key) { hidden.remove(key) } else { hidden.insert(key) }
        defaults.set(Array(hidden).sorted(), forKey: Self.hiddenKey)
    }

    /// `keys` in the viewer's order: those placed first, the rest after in
    /// the order given (new competitions land at the end of their family).
    func arranged(_ keys: [String]) -> [String] {
        let rank = Dictionary(order.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
        return keys.enumerated().sorted { a, b in
            switch (rank[a.element], rank[b.element]) {
            case let (x?, y?): x < y
            case (_?, nil): true
            case (nil, _?): false
            case (nil, nil): a.offset < b.offset
            }
        }.map(\.element)
    }

    /// Moves `key` one place up (-1) or down (+1) among `siblings`, the
    /// competitions of its family as shown.
    func move(_ key: String, by step: Int, among siblings: [String]) {
        var list = arranged(siblings)
        guard let i = list.firstIndex(of: key) else { return }
        let j = i + step
        guard list.indices.contains(j) else { return }
        list.swapAt(i, j)
        // The family's new order replaces its old place in the whole.
        let others = arranged(order.filter { !siblings.contains($0) })
        order = others + list
        defaults.set(order, forKey: Self.orderKey)
    }
}

/// The app's language, chosen in Settings, or the Apple TV's own (Julien,
/// build 36). tvOS reads an app's language when the app starts, so the choice
/// is also applied live (Julien, 2026-10-03: a change needed a restart): the
/// root sets the environment's locale, and the strings read outside a view
/// come from `bundle`.
enum LanguageChoice {
    static let codes = ["en", "fr", "pt", "es"]
    private static let key = "appLanguage"

    /// nil: the Apple TV's language.
    static var current: String? { UserDefaults.standard.string(forKey: key) }

    static func set(_ code: String?) {
        let d = UserDefaults.standard
        if let code {
            d.set(code, forKey: key)
            d.set([code], forKey: "AppleLanguages")
        } else {
            d.removeObject(forKey: key)
            d.removeObject(forKey: "AppleLanguages")
        }
    }

    /// The strings of the chosen language, or the app's own when there is none.
    static var bundle: Bundle {
        current.flatMap { Bundle.main.path(forResource: $0, ofType: "lproj") }.flatMap(Bundle.init(path:)) ?? .main
    }

    static var locale: Locale { current.map(Locale.init(identifier:)) ?? .current }

    /// "Français", in its own language.
    static func name(_ code: String) -> String {
        Locale(identifier: code).localizedString(forLanguageCode: code)?.capitalized ?? code
    }
}

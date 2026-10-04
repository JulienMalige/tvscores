import Foundation
import Observation

/// Which apps How to Watch may offer (Settings; Julien, 2026-10-04: "I prefer only Canal, I
/// don't want some": hidden, not removed). Every app is shown until it is turned off, and a
/// hidden app is offered on no game. Kept on this Apple TV; the proxy still names them all.
/// Keys are the table's, "canalplus", "disneyplus".
@MainActor
@Observable
final class AppChoice {
    static let shared = AppChoice()
    private static let key = "hiddenWatchApps"

    private(set) var hidden: Set<String>
    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        hidden = Set(defaults.stringArray(forKey: Self.key) ?? [])
    }

    func isShown(_ key: String) -> Bool { !hidden.contains(key) }

    func toggle(_ key: String) {
        if hidden.contains(key) { hidden.remove(key) } else { hidden.insert(key) }
        defaults.set(Array(hidden).sorted(), forKey: Self.key)
    }
}

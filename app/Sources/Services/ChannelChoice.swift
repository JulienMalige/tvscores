import Foundation
import Observation

/// Which countries' TV channels the viewer wants beside each game, chosen in
/// Settings: none, one or several (Julien, build 36). Kept on this Apple TV.
/// Views read it through `Event.channelList`, so a change in Settings
/// redraws every row that shows channels.
@MainActor
@Observable
final class ChannelChoice {
    static let shared = ChannelChoice()

    /// The countries the proxy has channels for, in the order they are shown.
    static let all = ["FR", "US", "BR"]
    private static let key = "channelCountries"

    private(set) var countries: [String]

    init(defaults: UserDefaults = .standard) {
        // Until the viewer chooses: the Apple TV's own country, or failing
        // that its language's — English the US, Portuguese Brazil, French
        // France (Julien, build 36).
        let saved = defaults.stringArray(forKey: Self.key)
        countries = (saved ?? Self.deviceDefault()).filter(Self.all.contains)
        self.defaults = defaults
    }

    @ObservationIgnored private let defaults: UserDefaults

    static func deviceDefault(_ locale: Locale = .current) -> [String] {
        if let region = locale.region?.identifier, all.contains(region) { return [region] }
        switch locale.language.languageCode?.identifier {
        case "en": return ["US"]
        case "pt": return ["BR"]
        case "fr": return ["FR"]
        default: return []
        }
    }

    func isOn(_ country: String) -> Bool { countries.contains(country) }

    func toggle(_ country: String) {
        var next = Set(countries)
        if next.contains(country) { next.remove(country) } else { next.insert(country) }
        countries = Self.all.filter(next.contains)
        defaults.set(countries, forKey: Self.key)
    }

    /// "🇫🇷" for "FR".
    static func flag(_ country: String) -> String {
        country.unicodeScalars.compactMap { UnicodeScalar(127397 + $0.value) }.map(String.init).joined()
    }
}

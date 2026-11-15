import Foundation
import UIKit

/// Everything the app knows about how the viewer set it up, sent with their
/// yes as Amplitude's user properties (Julien, 2026-11-14: "the most data we
/// can, to understand who are the users and how they use the app"): the
/// device's kind, the languages, the zone, the competitions followed in their
/// order, the countries and apps chosen, the teams followed. Nothing that says who they are.
struct UsageProfile: Equatable {
    var platform: String
    var edition: String
    /// The language chosen in Settings, or "system".
    var appLanguage: String
    var systemLanguage: String?
    var locale: String
    var region: String?
    var timeZone: String
    /// Shown competitions by name, in the menu's order; then the hidden.
    var shown: [String]
    var hidden: [String]
    var countries: [String]
    var hiddenApps: [String]
    var since: Date?
    /// The teams, drivers and players followed in My Teams, by name.
    var teams: [String] = []

    var properties: [String: Any] {
        var properties: [String: Any] = [
            "platform": platform, "edition": edition, "app_language": appLanguage, "locale": locale,
            "time_zone": timeZone, "competitions_shown": shown, "competitions_hidden": hidden,
            "competitions_followed": shown.count, "countries": countries, "apps_hidden": hiddenApps,
            "teams_followed": teams, "teams_count": teams.count,
        ]
        properties["system_language"] = systemLanguage
        properties["region"] = region
        properties["sharing_since"] = since.map { $0.formatted(.iso8601) }
        return properties
    }

    /// The profile as the app stands, for the competitions the board names.
    @MainActor
    static func current(leagues: [LeagueSummary]) -> UsageProfile {
        let shown = SportSection.grouped(leagues)
        return UsageProfile(
            platform: platform(UIDevice.current.userInterfaceIdiom),
            edition: Edition.current.rawValue,
            appLanguage: LanguageChoice.current ?? "system",
            systemLanguage: systemLanguage(),
            locale: Locale.current.identifier,
            region: Locale.current.region?.identifier,
            timeZone: TimeZone.current.identifier,
            shown: shown.flatMap(\.leagues).map(\.givenName),
            hidden: leagues.filter { !LeagueChoice.shared.isShown(MenuItem.key($0)) }.map(\.givenName),
            countries: ChannelChoice.shared.countries,
            hiddenApps: AppChoice.shared.hidden.sorted(),
            since: UsageChoice.shared.since,
            teams: Favourites.shared.followed.values.sorted())
    }

    static func platform(_ idiom: UIUserInterfaceIdiom) -> String {
        switch idiom {
        case .tv: "tv"
        case .pad: "pad"
        default: "phone"
        }
    }

    /// The device's own language. The app's choice is written into its own
    /// `AppleLanguages` (`LanguageChoice`), so the device's is read from the
    /// system-wide settings, falling back on the app's view of it.
    static func systemLanguage(_ defaults: UserDefaults = .standard) -> String? {
        let global = defaults.persistentDomain(forName: UserDefaults.globalDomain)?["AppleLanguages"] as? [String]
        return (global ?? Locale.preferredLanguages).first
    }
}

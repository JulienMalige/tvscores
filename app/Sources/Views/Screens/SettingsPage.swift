import SwiftUI

/// The pages of Settings: the top list and what it opens. Each says what it is called, what picture
/// stands for it on the left, and what its sentence says (Julien, build 36, from the Apple TV's own).
enum SettingsPage {
    case top, competitions, countries, language, apps, usage, openApps

    var title: LocalizedStringKey {
        switch self {
        case .top: "settings.title"
        case .competitions: "settings.competitions"
        case .countries: "settings.watch"
        case .language: "settings.language"
        case .apps: "settings.apps"
        case .usage: "settings.usageTitle"
        case .openApps: "settings.openApps"
        }
    }

    /// The system symbol on the left; the top page draws the app's mark instead.
    var symbol: String? {
        switch self {
        case .top: nil
        case .competitions: "trophy"
        case .countries: "tv"
        case .language: "globe"
        case .apps: "square.grid.2x2"
        case .usage: "hand.raised"
        case .openApps: "arrow.up.forward.app"
        }
    }

    /// The sentence under it.
    var blurb: LocalizedStringKey {
        switch self {
        case .top: "settings.blurb"
        case .competitions: "settings.competitionsNote"
        case .countries: "settings.countryNote"
        case .language: "settings.languageNote"
        case .apps: "settings.appsNote"
        // What sharing sends; a phone says it under its switch instead.
        case .usage: "settings.usageNote"
        case .openApps: "settings.openAppsNote"
        }
    }
}

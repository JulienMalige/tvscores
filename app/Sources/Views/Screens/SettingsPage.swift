import SwiftUI

/// The pages of Settings: the top list and what it opens. Each says what it is called, what picture
/// stands for it on the left, and what its sentence says (Julien, build 36, from the Apple TV's own).
enum SettingsPage {
    case top, competitions, countries, language, apps, openApps

    var title: LocalizedStringKey {
        switch self {
        case .top: "settings.title"
        case .competitions: "settings.competitions"
        case .countries: "settings.watch"
        case .language: "settings.language"
        case .apps: "settings.apps"
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
        case .openApps: "arrow.up.forward.app"
        }
    }

    /// The sentence under it; a competition being moved has its own.
    func blurb(moving: Bool) -> LocalizedStringKey {
        switch self {
        case .top: "settings.blurb"
        case .competitions: moving ? "settings.movingNote" : "settings.competitionsNote"
        case .countries: "settings.countryNote"
        case .language: "settings.languageNote"
        case .apps: "settings.appsNote"
        case .openApps: "settings.openAppsNote"
        }
    }
}

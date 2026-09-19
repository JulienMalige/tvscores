import Foundation
import Observation

/// Who is watching, as far as the app can know: a name typed once in
/// Settings, kept per Apple TV user because the app runs as the current
/// user. tvOS hands an app neither the profile's name nor its picture — nor,
/// since tvOS 16, the television's real name — so the name is the viewer's
/// to give, and the picture is the initials, as tvOS itself shows a user
/// without a photo.
@MainActor
@Observable
final class Profile {
    static let shared = Profile()

    var name: String {
        didSet { defaults.set(name, forKey: Self.key) }
    }

    private let defaults: UserDefaults
    private static let key = "profile.name"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        name = defaults.string(forKey: Self.key) ?? ""
    }

    /// "Julien Malige" → "JM", "julien" → "J", nothing → nil.
    var initials: String? { Self.initials(of: name) }

    static func initials(of name: String) -> String? {
        let parts = name.split(whereSeparator: { $0.isWhitespace || $0 == "-" }).prefix(2)
        let letters = parts.compactMap { $0.first }.map { String($0).uppercased() }
        return letters.isEmpty ? nil : letters.joined()
    }
}

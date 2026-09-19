import Foundation

/// Where a country's flat flag lives, from the emoji the proxy sends.
///
/// The proxy names a country by its flag emoji — two regional-indicator
/// letters, "🇦🇿" — and serves the same flag flat and square at
/// `/v1/assets/flags/az.png`. The emoji stays the fallback when the picture
/// has not come.
enum Flags {
    static func icon(for emoji: String?) -> URL? {
        guard let emoji, let code = code(emoji), let base = base else { return nil }
        return base.appending(path: "v1/assets/flags/\(code).png")
    }

    /// "🇦🇿" -> "az"; nil for anything that is not exactly two indicators.
    static func code(_ emoji: String) -> String? {
        let scalars = emoji.unicodeScalars.map(\.value)
        guard scalars.count == 2, scalars.allSatisfy({ (0x1F1E6...0x1F1FF).contains($0) }) else { return nil }
        return String(scalars.map { Character(UnicodeScalar($0 - 0x1F1E6 + 0x61)!) })
    }

    private static let base: URL? = (Bundle.main.object(forInfoDictionaryKey: "TVScoresProxyURL") as? String).flatMap(URL.init)
}

import SwiftUI

@main
struct TVScoresApp: App {
    init() {
        // The default cache is far too small to hold a board's worth of crests,
        // so images would be refetched every time a row scrolled back into view.
        URLCache.shared = URLCache(memoryCapacity: 32 << 20, diskCapacity: 256 << 20)
    }

    /// Read here so a new choice in Settings rebuilds the screens in it at once.
    @AppStorage("appLanguage") private var language: String?
    /// Kept here so rebuilding the screens in a new language keeps the board.
    @State private var store = ScoreboardStore()

    var body: some Scene {
        WindowGroup {
            Sidebar(store: store)
                .environment(\.locale, LanguageChoice.locale)
                .id(language ?? "system")
        }
    }
}

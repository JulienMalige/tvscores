import SwiftUI

@main
struct TVScoresApp: App {
    init() {
        // The default cache is far too small to hold a board's worth of crests,
        // so images would be refetched every time a row scrolled back into view.
        URLCache.shared = URLCache(memoryCapacity: 32 << 20, diskCapacity: 256 << 20)
    }

    var body: some Scene {
        WindowGroup {
            Sidebar()
        }
    }
}

import SwiftUI

@main
struct TVScoresApp: App {
    init() {
        // The default cache is far too small to hold a board's worth of crests,
        // so images would be refetched every time a row scrolled back into view.
        URLCache.shared = URLCache(memoryCapacity: 32 << 20, diskCapacity: 256 << 20)
        // The day switch is the system's segmented control, without the dark
        // track it draws behind its segments: on a page that is already a
        // stack of grey cards it read as one more. The chosen segment's grey
        // and the focused one's white are separate states and stay.
        let segments = UISegmentedControl.appearance()
        segments.setBackgroundImage(UIImage(), for: .normal, barMetrics: .default)
        segments.setDividerImage(UIImage(), forLeftSegmentState: .normal, rightSegmentState: .normal, barMetrics: .default)
    }

    var body: some Scene {
        WindowGroup {
            Sidebar()
        }
    }
}

import SwiftUI

/// A page's figures (`UsageEvent`): viewed when it comes up, left with the
/// seconds spent on it when it goes, or when the app goes to the background
/// and comes back. Nothing leaves without the viewer's yes (`Analytics`).
struct UsageTracker: ViewModifier {
    let page: UsageEvent.Page
    @State private var since: Date?
    @Environment(\.scenePhase) private var phase

    func body(content: Content) -> some View {
        content
            .onAppear(perform: begin)
            .onDisappear(perform: end)
            .onChange(of: phase) { _, now in
                if now == .active { begin() } else { end() }
            }
    }

    private func begin() {
        guard since == nil else { return }
        since = .now
        Analytics.shared.track(.pageViewed(page))
    }

    private func end() {
        guard let since else { return }
        self.since = nil
        Analytics.shared.track(.pageLeft(page, seconds: Int(Date.now.timeIntervalSince(since).rounded())))
    }
}

extension View {
    /// Counts this page's views and the time spent on it.
    func usagePage(_ page: UsageEvent.Page) -> some View {
        modifier(UsageTracker(page: page))
    }
}

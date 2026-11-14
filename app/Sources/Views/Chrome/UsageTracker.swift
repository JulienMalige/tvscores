import SwiftUI

/// A page's figures (`UsageEvent`, through `PageClock`): counted while the
/// page is in sight, which means placed in the navigation, with no game, race
/// or Settings over it (`usageCovered`), the app in the foreground and the
/// viewer sharing. A page left in the navigation under a pushed one, or
/// under a cover, does not count; nor does the time before a yes, so every
/// Page Left has its Page Viewed.
struct UsageTracker: ViewModifier {
    let page: UsageEvent.Page
    /// Between onAppear and onDisappear.
    @State private var placed = false
    @State private var clock = PageClock()
    @Environment(\.scenePhase) private var phase
    @Environment(\.usageCovered) private var covered

    func body(content: Content) -> some View {
        content
            .onAppear { placed = true; update() }
            .onDisappear { placed = false; update() }
            .onChange(of: phase) { update() }
            .onChange(of: covered) { update() }
            .onChange(of: Analytics.shared.isSending) { update() }
            .onChange(of: page.identity) { update() }
    }

    private func update() {
        let inSight = placed && phase == .active && !covered && Analytics.shared.isSending
        for event in clock.update(page, inSight: inSight) { Analytics.shared.track(event) }
    }
}

extension View {
    /// Counts this page's views and the time spent on it.
    func usagePage(_ page: UsageEvent.Page) -> some View {
        modifier(UsageTracker(page: page))
    }
}

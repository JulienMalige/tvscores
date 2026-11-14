import SwiftUI

/// The question, asked once when the first board shows, never over the
/// loader: whether the viewer shares how they use the app (`UsageChoice`,
/// docs/analytics.md). Share or Don't Share; Settings, Share usage data
/// changes the answer later. Around the whole app, on the television and on a
/// phone, it also reports the board's own figures: how long the first one
/// took, and when one fails or goes stale.
struct UsageQuestion: ViewModifier {
    let store: ScoreboardStore
    @State private var asking = false
    /// Up, for the television's menu: a press left on the question is not
    /// the page asking for the menu.
    @MainActor static private(set) var isUp = false

    /// On a phone or a tablet the screens are recorded too, and it says so.
    static var message: LocalizedStringKey {
        #if os(tvOS)
        return "usage.message"
        #else
        return "usage.messagePhone"
        #endif
    }

    func body(content: Content) -> some View {
        content
            .alert(Text("usage.title"), isPresented: $asking) {
                Button("usage.share") { answer(true) }
                Button("usage.decline", role: .cancel) { answer(false) }
            } message: {
                Text(Self.message)
            }
            .onChange(of: asking) { _, up in Self.isUp = up }
            .task(id: store.ready) {
                guard store.ready else { return }
                Analytics.shared.firstBoardShown(leagues: store.leagues)
                guard UsageChoice.asks(UsageChoice.shared.answer, simulator: Analytics.isSimulator) else { return }
                // The page first, then the question over it.
                try? await Task.sleep(for: .seconds(1.2))
                asking = true
            }
            .onChange(of: store.leagues) { _, leagues in Analytics.shared.boardChanged(leagues: leagues) }
            .onChange(of: store.error) { was, now in
                guard was == nil, let now else { return }
                Analytics.shared.track(.boardFailed(reason: now, boardOnScreen: store.board != nil))
            }
            .onChange(of: store.board?.isStale ?? false) { was, now in
                if now, !was { Analytics.shared.track(.boardStale) }
            }
    }

    private func answer(_ shares: Bool) {
        UsageChoice.shared.set(shares)
        Analytics.shared.apply(UsageChoice.shared, from: "question")
    }
}

extension View {
    /// The question and the board's figures, around the app's root.
    func usageQuestion(store: ScoreboardStore) -> some View {
        modifier(UsageQuestion(store: store))
    }
}

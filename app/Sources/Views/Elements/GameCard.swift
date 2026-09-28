import SwiftUI

/// A block on a game's page, as Apple Sports draws them: a rounded panel
/// a shade lighter than the page, its title centred on top. The remote can
/// stand on it, so a page of facts still scrolls.
struct GameCard<Content: View>: View {
    let title: LocalizedStringKey
    var identifier = ""
    @ViewBuilder var content: () -> Content
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: Metrics.cardGap) {
            Text(title).font(.headline)
            content()
        }
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, Metrics.cardInsetH)
        .frame(maxWidth: .infinity)
        .gameCardSurface(lit: isFocused)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier(identifier)
    }
}

extension View {
    /// The panel under a game card, and under a game page's table.
    func gameCardSurface(lit: Bool = false) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                    .fill(Color.white.opacity(lit ? 0.16 : 0.07))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Metrics.cardRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .animation(.easeOut(duration: 0.15), value: lit)
    }
}

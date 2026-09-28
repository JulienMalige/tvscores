import SwiftUI

/// A block the remote can stand on, lit like a row when it does. A page of
/// facts — a game's statistics, its venue — has nothing to press, but the
/// remote needs somewhere to be, or the page cannot scroll and Back has
/// nothing to leave from.
struct FocusBlock<Content: View>: View {
    var identifier: String = ""
    /// False for a block that sits on the page's tint, as a game's header:
    /// no panel, focused or not. It is there to hold the remote, not to be
    /// chosen, and Apple Sports draws nothing round it.
    var surface = true
    @ViewBuilder var content: () -> Content
    @FocusState private var isFocused: Bool

    var body: some View {
        content()
            .frame(maxWidth: .infinity)
            .modifier(Surface(on: surface, focused: isFocused))
            .focusable()
            .focused($isFocused)
            .accessibilityIdentifier(identifier)
    }
}

private struct Surface: ViewModifier {
    let on: Bool
    let focused: Bool

    func body(content: Content) -> some View {
        if on {
            content.rowSurface(focused: focused)
        } else {
            content
                .padding(.vertical, Metrics.rowInsetV)
        }
    }
}

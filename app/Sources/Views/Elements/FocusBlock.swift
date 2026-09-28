import SwiftUI

/// A block the remote can stand on, lit like a row when it does. A page of
/// facts — a game's statistics, its venue — has nothing to press, but the
/// remote needs somewhere to be, or the page cannot scroll and Back has
/// nothing to leave from.
struct FocusBlock<Content: View>: View {
    var identifier: String = ""
    @ViewBuilder var content: () -> Content
    @FocusState private var isFocused: Bool

    var body: some View {
        content()
            .frame(maxWidth: .infinity)
            .rowSurface(focused: isFocused)
            .focusable()
            .focused($isFocused)
            .accessibilityIdentifier(identifier)
    }
}

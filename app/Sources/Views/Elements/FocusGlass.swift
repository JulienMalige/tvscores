import SwiftUI

/// What the remote is on, said with glass rather than white (Julien, build
/// 32): a brighter pane of the page's own colour, edged in light and lifted
/// on a shadow. White made everything drawn for the dark vanish on it —
/// white marks, a portrait's initials, a live clock's green — and outlining
/// each one never caught them all. On glass they stay as they are.
struct FocusGlass<S: Shape>: ViewModifier {
    let focused: Bool
    let shape: S
    /// The pane's white when the remote is elsewhere: none, or a faint card.
    var resting: Double = 0

    func body(content: Content) -> some View {
        content
            .background {
                shape
                    .fill(Color.white.opacity(focused ? Metrics.glassFill : resting))
                    .overlay(shape.stroke(Color.white.opacity(focused ? Metrics.glassEdge : 0), lineWidth: 1.5))
                    .shadow(color: .black.opacity(focused ? 0.35 : 0), radius: 22, y: 12)
            }
    }
}

extension View {
    func focusGlass(_ focused: Bool, in shape: some Shape, resting: Double = 0) -> some View {
        modifier(FocusGlass(focused: focused, shape: shape, resting: resting))
    }
}

/// A button that draws nothing of its own: the row says focus itself, on
/// glass. The system's own highlight on a plain button is the white pane.
struct QuietButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

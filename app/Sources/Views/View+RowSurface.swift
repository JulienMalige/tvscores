import SwiftUI

extension View {
    /// The card a list row sits on. tvOS says "this one" by lightening and
    /// lifting it, and every row in the app says it the same way.
    func rowSurface(focused: Bool, radius: CGFloat = 20, scale: CGFloat = 1.02) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .fill(Color.white.opacity(focused ? 0.14 : 0.04))
            )
            .scaleEffect(focused ? scale : 1)
            .animation(.easeOut(duration: 0.15), value: focused)
    }
}

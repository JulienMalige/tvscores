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
            Text(title).font(.body.weight(.semibold))
            content()
        }
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, Metrics.cardInsetH)
        .frame(maxWidth: .infinity)
        .gameCardSurface(lit: isFocused, radius: Metrics.gameCardRadius)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier(identifier)
    }
}

extension View {
    /// The panel under a game card, and under a game page's table.
    func gameCardSurface(lit: Bool = false, radius: CGFloat = Metrics.cardRadius) -> some View {
        modifier(GameCardSurface(lit: lit, radius: radius))
    }
}

/// On a plain page, white at 7%: a shade lighter than the dark. On a tinted
/// one, a deeper shade of the page's own hue, a little translucent, as Apple
/// Sports draws its panels — navy on the NBA's page, dark green on Home. The
/// faint white over it keeps a panel visible on the near-black pages (F1, La
/// Liga), where a darker shade of the page alone would vanish into it.
private struct GameCardSurface: ViewModifier {
    let lit: Bool
    let radius: CGFloat
    @Environment(\.pageTint) private var tint

    func body(content: Content) -> some View {
        content
            .background {
                let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
                if let tint {
                    shape.fill(tint.mix(with: .black, by: 0.4).opacity(0.8))
                        .overlay(shape.fill(Color.white.opacity(lit ? 0.12 : 0.04)))
                } else {
                    shape.fill(Color.white.opacity(lit ? 0.16 : 0.07))
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .animation(.easeOut(duration: 0.15), value: lit)
    }
}

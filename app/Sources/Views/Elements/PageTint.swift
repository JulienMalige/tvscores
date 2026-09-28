import SwiftUI

/// The colour a page is tinted with, as Apple Sports tints each competition's
/// page with the competition's own colour and its Home with green. Screens
/// set it; the panels on them read it, so a panel on the NBA's page is a
/// deeper navy rather than a neutral grey. Nil where a page has no tint.
extension EnvironmentValues {
    @Entry var pageTint: Color? = nil
}

extension Color {
    /// Home's green, taken from Apple Sports' Home (#1f5a28).
    static let homeTint = Color(red: 0x1f / 255, green: 0x5a / 255, blue: 0x28 / 255)
}

/// Behind a tinted page: its colour at the top, running down the whole page
/// to a much darker shade of the same hue, the way Apple Sports does it —
/// not to grey, which would lose the colour behind the lower panels. Drawn
/// full-bleed and behind the scroll view, so it stays put as the page moves.
/// GameBackdrop, on a game's page, is the two-team version of this.
struct PageTint: View {
    let color: Color?

    var body: some View {
        if let color {
            LinearGradient(colors: [color, color.mix(with: .black, by: 0.7)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        }
    }
}

extension View {
    /// Tints the page and tells its panels which colour they sit on.
    func pageTint(_ color: Color?) -> some View {
        self
            .background(PageTint(color: color))
            .environment(\.pageTint, color)
    }
}

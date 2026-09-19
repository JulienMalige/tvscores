import SwiftUI

/// The vocabulary the whole app is built from. Four levels, each with its own
/// folder and its own name ending, so a file says what it is before you open it:
///
/// - **Screen** (`Views/Screens`) — a whole page you navigate to. It owns the
///   scroll view, the page margins and the navigation, and nothing else.
/// - **Section** (`Views/Sections`) — a titled band inside a screen: a heading
///   and the list under it. Sections stack; they never nest.
/// - **Row** (`Views/Rows`) — one focusable line of a list. Every row sits on
///   `rowSurface`, so they are all the same height and all light up the same way.
/// - **Element** (`Views/Elements`) — the atoms a row is made of: the marks
///   (`TeamMark`, `PersonMark`, `LeagueMark`), `StatusLabel`, `DayTabs`.
///
/// Every measurement a screen, section or row uses lives here. A view that
/// invents its own number drifts away from the others, which is exactly how the
/// standings rows ended up shorter than every other list in the app.
enum Metrics {
    /// Page margins. The horizontal one is the app's left edge, everywhere.
    static let screenMargin: CGFloat = 80
    static let screenTop: CGFloat = 60
    static let screenBottom: CGFloat = 80

    /// Between two sections, and between a section's heading and its list.
    static let sectionGap: CGFloat = 48
    static let headingGap: CGFloat = 18

    /// One row: the card's inset, its corner, and the space to the next row.
    static let rowInsetV: CGFloat = 18
    static let rowInsetH: CGFloat = 28
    static let rowRadius: CGFloat = 20
    static let rowGap: CGFloat = 10

    /// The identity image in a row — crest, constructor badge or portrait. One
    /// size for all three. A row is as tall as the tallest thing inside it plus
    /// the inset: 100 points where that is the mark, more where a second line
    /// of text or a scoreline is taller than it.
    static let mark: CGFloat = 64
    /// The same thing blown up for a podium, where it is the subject.
    static let markHero: CGFloat = 110
    /// Competition marks are wordmarks as often as badges, so they get width.
    static let leagueMark: CGFloat = 52
    /// One column of a table read as numbers — played, won, points.
    static let tableCell: CGFloat = 96
    /// A pill of a switch: its inset, and the gap to the next.
    static let pillInsetV: CGFloat = 14
    static let pillInsetH: CGFloat = 32
    static let pillGap: CGFloat = 16
}

extension View {
    /// The card a row sits on. tvOS says "this one" by lightening and lifting
    /// it, and every row in the app says it the same way and at the same size.
    func rowSurface(focused: Bool) -> some View {
        self
            .padding(.vertical, Metrics.rowInsetV)
            .padding(.horizontal, Metrics.rowInsetH)
            .background(
                RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous)
                    .fill(Color.white.opacity(focused ? 0.14 : 0.04))
            )
            .scaleEffect(focused ? 1.02 : 1)
            .animation(.easeOut(duration: 0.15), value: focused)
    }
}

extension View {
    /// A screen's margins: the app's left edge, and room above and below.
    func pageMargins() -> some View {
        self
            .padding(.horizontal, Metrics.screenMargin)
            .padding(.top, Metrics.screenTop)
            .padding(.bottom, Metrics.screenBottom)
    }
}

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
    /// Nothing beyond tvOS's own safe area, where Apple's panels start
    /// (docs/design-measures.md): the 80 added to it wasted a twelfth of
    /// the screen's width.
    static let screenMargin: CGFloat = 0
    /// A list page's column, centred: a phone's list stretched to 16:9 left
    /// a wide gap between each score and the middle. As Apple Sports on an
    /// iPad (Julien picked it of three tried on build 29).
    static let pageWidth: CGFloat = 1400
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
    /// A match row's team column — the crest with the name captioned under
    /// it — and the score column beside it. The name gets the column's
    /// width and shrinks a little before it truncates.
    static let matchSide: CGFloat = 180
    /// A match row, in the proportions measured off Apple Sports' list on
    /// build 29 (a crest 98 px, its score's type 121, the league's mark 63,
    /// a row 272): the crest, the score's type about 1.2 times it, and the
    /// space the row takes above and below its content.
    static let matchMark: CGFloat = 80
    static let matchScoreType: CGFloat = 80
    static let matchRowPad: CGFloat = 18
    static let matchNameGap: CGFloat = 6
    static let matchScore: CGFloat = 150
    /// A tennis row, from Apple Sports' (its points doubled): a line per
    /// player 70 high, a 56 portrait, games 44 tall in 50-wide columns.
    static let tennisLine: CGFloat = 70
    static let tennisLineGap: CGFloat = 6
    static let tennisRowPad: CGFloat = 14
    static let tennisMark: CGFloat = 56
    static let tennisNameGap: CGFloat = 20
    static let tennisGames: CGFloat = 46
    static let tennisSetColumn: CGFloat = 50
    static let tennisSetGap: CGFloat = 24
    static let tennisArrow: CGFloat = 36
    /// The most a row's channel line may take beside the players.
    static let tennisChannels: CGFloat = 320
    /// The same thing blown up for a podium, where it is the subject.
    static let markHero: CGFloat = 110
    /// A race weekend's flag over its caption on the front page, while
    /// there is no podium yet: smaller than the series page's.
    static let raceRowFlag: CGFloat = 52
    /// The front row of the grid under a race page's header.
    static let frontRowMark: CGFloat = 80
    /// A classification's place column, before the portrait.
    static let placeWidth: CGFloat = 44
    /// A game page's crests under their scores (Apple's 33 pt, doubled).
    static let gameMark: CGFloat = 67
    /// A game's page, drawn as the Apple TV app's show page: a card inset
    /// from the screen's top and sides by the margin, with rounded top
    /// corners, running off the bottom; inside it, the page's own inset.
    static let gameMargin: CGFloat = 48
    static let gameRadius: CGFloat = 56
    static let gameInset: CGFloat = 40
    static let gameGap: CGFloat = 40
    /// Its header: each side's column, the middle between them, and the
    /// score's tall figures, measured against Apple Sports' 60-point score
    /// on a 17-point name (build 26 review).
    static let gameSide: CGFloat = 560
    static let gameCentre: CGFloat = 460
    static let gameScore: CGFloat = 166
    /// The same on a tennis match's page.
    static let gameSetScore: CGFloat = 96
    /// The team code's column in the score by quarter.
    static let periodName: CGFloat = 140
    /// A statistic's figures, the same tall face as the score.
    static let statValue: CGFloat = 41
    /// A game card: its corner, its insets, and the space under its title.
    static let cardRadius: CGFloat = 48
    /// A card inside a game's page, rounder than the page's panels are not.
    static let gameCardRadius: CGFloat = 32
    static let cardInsetV: CGFloat = 32
    static let cardInsetH: CGFloat = 44
    static let cardGap: CGFloat = 26
    /// Competition marks are wordmarks as often as badges, so they get width.
    static let leagueMark: CGFloat = 52
    /// The same over a list of games, two thirds of a team's crest.
    static let leagueMarkSmall: CGFloat = 43
    /// A competition mark is sized by the room it covers, not its height:
    /// at one height ATP's wordmark took five times the Nations League's
    /// badge (Julien, build 30). As much ink as a square 1.35 times the
    /// mark's nominal size, held between these bounds of that size.
    static let leagueMarkArea: CGFloat = 1.35
    static let leagueMarkShortest: CGFloat = 0.65
    static let leagueMarkTallest: CGFloat = 1.25
    static let leagueMarkWidest: CGFloat = 2.55
    /// A list's league heading, in from the panel's edge: clear of its
    /// rounded corner (radius 48) and in line with the crests under it.
    static let leagueHeadingInset: CGFloat = 24
    /// A pill of a switch, the size of the Apple TV app's season pills.
    static let pillInsetV: CGFloat = 10
    static let pillInsetH: CGFloat = 26
    static let pillGap: CGFloat = 12
    /// The menu, measured off tvOS's own sidebar in the build 19 screenshots:
    /// its width and distance from the screen's edge, a row's inset and the
    /// space between rows, the icon, and the type, a little under body.
    static let menuWidth: CGFloat = 370
    static let menuMargin: CGFloat = 36
    static let menuInset: CGFloat = 16
    static let menuRowInsetV: CGFloat = 12
    static let menuRowInsetH: CGFloat = 18
    static let menuRowGap: CGFloat = 8
    static let menuIcon: CGFloat = 40
    static let menuFont: CGFloat = 26
    static let menuRadius: CGFloat = 40
    /// One column of a table read as numbers — played, won, points.
    static let tableCell: CGFloat = 70
    /// The gap between two number columns: a column every 82, as Apple's.
    static let tableGap: CGFloat = 12
    /// A table row's crest or portrait (Apple's 19 pt, doubled), and the
    /// room above and below its line: rows 80 apart, as Apple's 40.
    static let tableMark: CGFloat = 40
    static let tableRowPad: CGFloat = 14
    /// Focus on glass: the pane's white and its edge's.
    static let glassFill: CGFloat = 0.2
    static let glassEdge: CGFloat = 0.35
}

extension View {
    /// The card a row sits on. tvOS says "this one" by lightening and lifting
    /// it, and every row in the app says it the same way and at the same size.
    func rowSurface(focused: Bool, resting: Double = 0.04, insetV: CGFloat = Metrics.rowInsetV) -> some View {
        self
            .padding(.vertical, insetV)
            .padding(.horizontal, Metrics.rowInsetH)
            .focusGlass(focused, in: RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous), resting: resting)
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

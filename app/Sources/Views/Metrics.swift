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
///
/// The numbers are the television's, and `.tv` sets them for the device the
/// app runs on: as written on the television, halved on an iPhone or an iPad.
enum Metrics {
    /// Page margins. The horizontal one is the app's left edge, everywhere.
    /// Nothing beyond tvOS's own safe area, where Apple's panels start
    /// (docs/design-measures.md): the 80 added to it wasted a twelfth of
    /// the screen's width.
    static let screenMargin: CGFloat = .tv(0, phone: 16)
    /// A list page's column, centred: a phone's list stretched to 16:9 left
    /// a wide gap between each score and the middle. As Apple Sports on an
    /// iPad (Julien picked it of three tried on build 29).
    static let pageWidth: CGFloat = .tv(1400)
    static let screenTop: CGFloat = .tv(60, phone: 12)
    static let screenBottom: CGFloat = .tv(80)

    /// Between two sections, and between a section's heading and its list.
    static let sectionGap: CGFloat = .tv(48)
    static let headingGap: CGFloat = .tv(18)

    /// One row: the card's inset, its corner, and the space to the next row.
    static let rowInsetV: CGFloat = .tv(18)
    static let rowInsetH: CGFloat = .tv(28)
    static let rowRadius: CGFloat = .tv(20)
    static let rowGap: CGFloat = .tv(10)

    /// The identity image in a row — crest, constructor badge or portrait. One
    /// size for all three. A row is as tall as the tallest thing inside it plus
    /// the inset: 100 points where that is the mark, more where a second line
    /// of text or a scoreline is taller than it.
    static let mark: CGFloat = .tv(64)
    /// A match row's team column — the crest with the name captioned under
    /// it — and the score column beside it. The name gets the column's
    /// width and shrinks a little before it truncates.
    static let matchSide: CGFloat = .tv(180, phone: 66)
    /// A match row, in the proportions measured off Apple Sports' list on
    /// build 29 (a crest 98 px, its score's type 121, the league's mark 63,
    /// a row 272): the crest, the score's type about 1.2 times it, and the
    /// space the row takes above and below its content.
    static let matchMark: CGFloat = .tv(80)
    static let matchScoreType: CGFloat = .tv(80, phone: 34)
    static let matchRowPad: CGFloat = .tv(18)
    static let matchNameGap: CGFloat = .tv(6)
    static let matchScore: CGFloat = .tv(150, phone: 58)
    /// A tennis row, from Apple Sports' (its points doubled): a line per
    /// player 70 high, a 56 portrait, games 44 tall in 50-wide columns.
    static let tennisLine: CGFloat = .tv(70)
    static let tennisLineGap: CGFloat = .tv(6)
    static let tennisRowPad: CGFloat = .tv(14)
    static let tennisMark: CGFloat = .tv(56)
    static let tennisNameGap: CGFloat = .tv(20)
    static let tennisGames: CGFloat = .tv(46)
    static let tennisSetColumn: CGFloat = .tv(50)
    static let tennisSetGap: CGFloat = .tv(24)
    static let tennisArrow: CGFloat = .tv(36)
    /// The most a row's channel line may take beside the players.
    static let tennisChannels: CGFloat = .tv(320)
    /// A country's round flag before its channels, and in Settings' list.
    static let channelFlag: CGFloat = .tv(28)
    static let settingsFlag: CGFloat = .tv(44, phone: 28)
    /// Settings, after tvOS's own: the mark on the left, the list on the right.
    static let settingsMark: CGFloat = .tv(520)

    // How to Watch: a card per app, its wide tvOS icon (5:3) on the left.
    static let watchIconHeight: CGFloat = .tv(96)
    static let watchCardGap: CGFloat = .tv(14)
    /// Cards to a line (Julien: "four, three or five"): even columns, so a row is as tall as its tallest.
    #if os(tvOS)
    static let watchCardsPerLine = 4
    #else
    static let watchCardsPerLine = 2
    #endif
    /// A card's icon, and the room around it, when several share a line: tight enough that "Open In
    /// NBC Sports" is not cut off.
    static let watchTileIconHeight: CGFloat = .tv(56)
    static let watchTileInsetH: CGFloat = .tv(14)
    static let watchTileInsetV: CGFloat = .tv(12)

    // The launch loader: the app's mark, then a bar that fills as the launch does.
    static let launchMark: CGFloat = .tv(360)
    static let launchBarWidth: CGFloat = .tv(420)
    static let launchBarHeight: CGFloat = .tv(8)
    static let settingsGap: CGFloat = .tv(80)
    static let settingsMargin: CGFloat = .tv(120)
    static let settingsTitleGap: CGFloat = .tv(40)
    /// The same thing blown up for a podium, where it is the subject.
    static let markHero: CGFloat = .tv(110)
    /// A race weekend's flag over its caption on the front page, while
    /// there is no podium yet: smaller than the series page's.
    static let raceRowFlag: CGFloat = .tv(52)
    /// The front row of the grid under a race page's header.
    static let frontRowMark: CGFloat = .tv(80)
    /// A classification's place column, before the portrait.
    static let placeWidth: CGFloat = .tv(44)
    /// A game page's crests under their scores (Apple's 33 pt, doubled).
    static let gameMark: CGFloat = .tv(67)
    /// A game's page, drawn as the Apple TV app's show page: a card inset
    /// from the screen's top and sides by the margin, with rounded top
    /// corners, running off the bottom; inside it, the page's own inset.
    static let gameMargin: CGFloat = .tv(48)
    static let gameRadius: CGFloat = .tv(56)
    static let gameInset: CGFloat = .tv(40)
    static let gameGap: CGFloat = .tv(40)
    /// Its header: each side's column, the middle between them, and the
    /// score's tall figures, measured against Apple Sports' 60-point score
    /// on a 17-point name (build 26 review).
    static let gameSide: CGFloat = .tv(560, phone: 110)
    static let gameCentre: CGFloat = .tv(460, phone: 133)
    static let gameScore: CGFloat = .tv(166, phone: 60)
    /// A tennis match's set table under the two players: as wide as the
    /// header above it, so the names start under the first portrait and
    /// the games end under the second.
    static let gameSetTable: CGFloat = gameSide * 2 + gameCentre
    /// The team code's column in the score by quarter.
    static let periodName: CGFloat = .tv(140)
    /// A statistic's figures, the same tall face as the score.
    static let statValue: CGFloat = .tv(41)
    /// A game card: its corner, its insets, and the space under its title.
    static let cardRadius: CGFloat = .tv(48)
    /// A card inside a game's page, rounder than the page's panels are not.
    static let gameCardRadius: CGFloat = .tv(32)
    static let cardInsetV: CGFloat = .tv(32)
    static let cardInsetH: CGFloat = .tv(44)
    static let cardGap: CGFloat = .tv(26)
    /// Competition marks are wordmarks as often as badges, so they get width.
    static let leagueMark: CGFloat = .tv(52)
    /// The same over a list of games, two thirds of a team's crest.
    static let leagueMarkSmall: CGFloat = .tv(43)
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
    static let leagueHeadingInset: CGFloat = .tv(24)
    /// A pill of a switch, the size of the Apple TV app's season pills.
    static let pillInsetV: CGFloat = .tv(10)
    static let pillInsetH: CGFloat = .tv(26)
    static let pillGap: CGFloat = .tv(12)
    /// The menu, measured off tvOS's own sidebar in the build 19 screenshots:
    /// its width and distance from the screen's edge, a row's inset and the
    /// space between rows, the icon, and the type, a little under body.
    static let menuWidth: CGFloat = .tv(370)
    static let menuMargin: CGFloat = .tv(36)
    static let menuInset: CGFloat = .tv(16)
    static let menuRowInsetV: CGFloat = .tv(12)
    static let menuRowInsetH: CGFloat = .tv(18)
    static let menuRowGap: CGFloat = .tv(8)
    static let menuIcon: CGFloat = .tv(40, phone: 28)
    static let menuFont: CGFloat = .tv(26)
    static let menuRadius: CGFloat = .tv(40)
    /// One column of a table read as numbers — played, won, points.
    static let tableCell: CGFloat = .tv(70, phone: 26)
    /// The gap between two number columns: a column every 82, as Apple's.
    static let tableGap: CGFloat = .tv(12, phone: 2)
    /// A table row's inset at its sides: a row's on the television; on a
    /// phone, little, so the names keep the room seven columns leave them.
    static let tableRowInsetH: CGFloat = .tv(28, phone: 6)
    /// A table row's crest or portrait (Apple's 19 pt, doubled), and the
    /// room above and below its line: rows 80 apart, as Apple's 40.
    static let tableMark: CGFloat = .tv(40)
    static let tableRowPad: CGFloat = .tv(14)
    /// How small a column's word or number may be set to keep to one line:
    /// "1.000", French's "Bonus".
    static let tableShrink: CGFloat = 0.7
    /// The lines of small print about a table, its source and its legend.
    static let tableNoteGap: CGFloat = .tv(4)
    /// Focus on glass: the pane's white and its edge's.
    static let glassFill: CGFloat = 0.2
    static let glassEdge: CGFloat = 0.35
}

extension CGFloat {
    /// A measure drawn for the television, on this device. The television's
    /// sizes are twice Apple Sports' on an iPhone (k = 2,
    /// docs/design-measures.md), so an iPhone or an iPad takes half — Apple's
    /// own size — or `phone`, where half does not fit a phone's width.
    static func tv(_ points: CGFloat, phone: CGFloat? = nil) -> CGFloat {
        #if os(tvOS)
        return points
        #else
        return phone ?? points / 2
        #endif
    }
}

extension View {
    /// The card a row sits on. tvOS says "this one" by lightening and lifting
    /// it, and every row in the app says it the same way and at the same size.
    func rowSurface(focused: Bool, resting: Double = 0.04, insetV: CGFloat = Metrics.rowInsetV, insetH: CGFloat = Metrics.rowInsetH) -> some View {
        self
            .padding(.vertical, insetV)
            .padding(.horizontal, insetH)
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

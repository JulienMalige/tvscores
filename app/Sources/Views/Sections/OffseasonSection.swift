import SwiftUI

/// A competition whose new season has not begun, in the board card's place
/// for an empty day, as Apple Sports words it: "2026–2027 Season Starts
/// Saturday", and "Check the schedule in Upcoming." once the first games
/// are there. A break inside a season — the Champions League between
/// rounds — gets the plain empty day instead; Apple says nothing there of
/// when it is back (Julien, 2026-09-28).
struct OffseasonSection: View {
    let next: NextGame
    let season: String

    /// Within the Upcoming list's reach: its games are there to look at.
    private static let upcomingReach: TimeInterval = 7 * 86400

    /// The words for the season to come, for any sport, or nil for a break
    /// inside a season. The proxy says which, from the season its games
    /// last carried: then the feed's label, "2026–2027", or the league's
    /// name. A feed with no seasons at all (the race calendars) counts a
    /// gap of more than six weeks, longer than any break in a calendar we
    /// follow, as between seasons.
    static func season(of next: NextGame, league: String, now: Date = .now) -> String? {
        let label = next.season?.replacingOccurrences(of: "-", with: "–")
        switch next.newSeason {
        case true?: return label ?? league
        case false?: return nil
        case nil: return next.start.timeIntervalSince(now) > 45 * 86400 ? league : nil
        }
    }

    private var inReach: Bool { next.start.timeIntervalSinceNow < Self.upcomingReach }

    var body: some View {
        EmptyDay(title: Text(verbatim: title), line: inReach ? Text("offseason.checkUpcoming") : nil)
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("offseason")
    }

    /// "Season Starts Saturday" within the week, "Season Starts October 21"
    /// within six, "Season Starts in October" beyond.
    private var title: String {
        let gap = next.start.timeIntervalSinceNow
        if gap < Self.upcomingReach {
            return String(format: String(localized: "offseason.startsDay"), season, next.start.formatted(.dateTime.weekday(.wide)))
        }
        if gap < 45 * 86400 {
            return String(format: String(localized: "offseason.startsDate"), season, next.start.formatted(.dateTime.day().month(.wide)))
        }
        return String(format: String(localized: "offseason.startsMonth"), season, next.start.formatted(.dateTime.month(.wide)))
    }
}

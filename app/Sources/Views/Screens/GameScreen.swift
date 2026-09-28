import SwiftUI

/// One game, opened from its row: rises over the page as a sheet, and Back
/// puts it away. After Apple Sports' game card (Julien, 2026-09-28), without
/// what we do not have — no following, no play-by-play.
///
/// What it shows depends on where the game is:
/// - to come: the table the two teams sit in, and when and where;
/// - under way or over: the score by quarter (NFL, NBA), a short set of
///   statistics (football, NBA), goals and cards (football), the venue.
/// Tennis has its tournament over the two players and nothing else to add.
struct GameScreen: View {
    let eventId: String
    let fallback: Event
    let store: ScoreboardStore
    @State private var detail: GameDetail?

    /// Re-read from the store on every pass, so a live score keeps moving.
    private var found: (event: Event, group: LeagueGroup)? { store.board?.find(eventId) }
    private var event: Event { found?.event ?? fallback }

    private var competition: String {
        if let c = event.competition {
            return [c.name, c.tier].compactMap { $0 }.joined(separator: " · ")
        }
        return found?.group.league.name ?? ""
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap * 0.6) {
                GameHeaderSection(event: event, competition: competition, records: detail?.records)
                if event.status.state != .scheduled {
                    if let periods = detail?.periods { PeriodSection(periods: periods, home: event.home, away: event.away) }
                    if let stats = detail?.stats, !stats.isEmpty { StatsSection(stats: stats) }
                    if let moments = detail?.timeline, !moments.isEmpty { MomentsSection(moments: moments) }
                }
                if event.sport != "tennis" {
                    GameInfoSection(start: event.start, venue: detail?.venue, place: detail?.city)
                    if let group = found?.group, group.league.hasStandings == true {
                        StandingsSection(ref: LeagueRef(group: group), store: store,
                                         highlight: Set([event.home?.name, event.away?.name].compactMap { $0 }))
                    }
                }
            }
            .pageMargins()
        }
        .accessibilityIdentifier("page.game")
        .task(id: eventId) {
            // Asked when opened; again each minute while the game is on.
            while !Task.isCancelled {
                if let fresh = await store.detail(for: eventId) { detail = fresh }
                guard event.status.state == .live else { return }
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }
}

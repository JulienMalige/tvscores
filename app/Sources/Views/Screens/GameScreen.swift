import SwiftUI

/// One game, opened from its row: a card over the page, inset at the top
/// and sides and running off the bottom, as the Apple TV app's show page, and Back
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
    @State private var tints: (home: Color?, away: Color?) = (nil, nil)

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
            VStack(spacing: Metrics.gameGap) {
                GameHeaderSection(event: event, competition: competition, records: detail?.records)
                if event.status.state != .scheduled {
                    if let periods = detail?.periods { PeriodSection(periods: periods, home: event.home, away: event.away) }
                    if let stats = detail?.stats, !stats.isEmpty {
                        StatsSection(stats: stats, homeTint: tints.home, awayTint: tints.away)
                    }
                    if let moments = detail?.timeline, !moments.isEmpty { MomentsSection(moments: moments) }
                }
                if event.sport != "tennis" {
                    if let group = found?.group, group.league.hasStandings == true {
                        StandingsSection(ref: LeagueRef(group: group), store: store,
                                         highlight: Set([event.home?.name, event.away?.name].compactMap { $0 }),
                                         carded: true)
                    }
                    GameInfoSection(start: event.start, venue: detail?.venue, place: detail?.city)
                }
            }
            .padding(.horizontal, Metrics.gameInset)
            .padding(.top, Metrics.gameInset / 2)
            .padding(.bottom, Metrics.screenBottom)
        }
        .background(GameBackdrop(home: tints.home, away: tints.away))
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: Metrics.gameRadius,
                                          topTrailingRadius: Metrics.gameRadius, style: .continuous))
        .padding([.top, .horizontal], Metrics.gameMargin)
        .ignoresSafeArea()
        .presentationBackground(Color.black.opacity(0.6))
        .accessibilityIdentifier("page.game")
        .task(id: eventId) {
            async let home = TeamTint.of(event.home)
            async let away = TeamTint.of(event.away)
            tints = await (home, away)
        }
        .task(id: eventId) {
            // Asked when opened; again each minute until the game is over.
            while !Task.isCancelled {
                if let fresh = await store.detail(for: eventId) { detail = fresh }
                // Until the whistle: a page opened before kickoff has to see
                // the game start to fetch its periods, stats and goals.
                guard event.status.state != .final else { return }
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }
}

/// Behind a game's page: the two sides' colours across the top, home on the
/// left, fading to the page's dark by the middle, as Apple Sports tints its
/// game cards. Grey where a crest gave no colour.
private struct GameBackdrop: View {
    let home: Color?
    let away: Color?

    var body: some View {
        ZStack {
            Color(white: 0.11)
            LinearGradient(colors: [home ?? Color(white: 0.3), away ?? Color(white: 0.3)],
                           startPoint: .leading, endPoint: .trailing)
                .opacity(0.55)
            LinearGradient(stops: [.init(color: .clear, location: 0),
                                   .init(color: Color(white: 0.11), location: 0.6)],
                           startPoint: .top, endPoint: .bottom)
        }
    }
}

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
/// Tennis has its tournament over the two players, and the tour's ranking.
struct GameScreen: View {
    let eventId: String
    let fallback: Event
    let store: ScoreboardStore
    @State private var detail: GameDetail?
    @State private var tints: (home: Color?, away: Color?) = (nil, nil)
    @State private var standings: Standings?
    /// The first answers about the game have come, empty or not.
    @State private var ready = false

    /// Re-read from the store on every pass, so a live score keeps moving.
    private var found: (event: Event, group: LeagueGroup)? { store.board?.find(eventId) }
    private var event: Event { found?.event ?? fallback }

    private var competition: String {
        if let c = event.competition {
            return [c.name, c.tier].compactMap { $0 }.joined(separator: " · ")
        }
        return found?.group.league.name ?? ""
    }

    /// The table both sides sit in, when the competition has one.
    private var standingsRef: LeagueRef? {
        guard let group = found?.group, group.league.hasStandings == true else { return nil }
        return LeagueRef(group: group)
    }

    private func loadTable(_ ref: LeagueRef?) async -> Standings? {
        guard let ref else { return nil }
        return await store.standings(for: ref)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Metrics.gameGap) {
                GameHeaderSection(event: event, competition: competition, records: detail?.records)
                // Right under the score, before the statistics: where to watch is what the page is
                // opened for (Julien, build 33), and after the whistle the app has the replay.
                let cards = event.watchCards(store.board?.apps)
                if !cards.isEmpty { HowToWatchSection(cards: cards) }
                if !ready {
                    // One native loader under the score while the rest
                    // comes, then the rest at once: a skeleton for the
                    // statistics, and the table and venue arriving
                    // before them, moved the page about (Julien, build 30).
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 320)
                } else {
                    if event.status.state != .scheduled {
                        if let periods = detail?.periods { PeriodSection(periods: periods, home: event.home, away: event.away) }
                        if let stats = detail?.stats, !stats.isEmpty {
                            StatsSection(stats: stats, homeTint: tints.home, awayTint: tints.away)
                        }
                        if let moments = detail?.timeline, !moments.isEmpty { MomentsSection(moments: moments) }
                    }
                    // The table both sides sit in: a league's, or a tour's
                    // ranking with the two players picked out (Julien, build 28).
                    if let ref = standingsRef {
                        StandingsSection(ref: ref, store: store,
                                         highlight: Set([event.home?.name, event.away?.name].compactMap { $0 }),
                                         carded: true, preloaded: standings)
                    }
                    if event.sport != "tennis" {
                        GameInfoSection(start: event.start, venue: detail?.venue, place: detail?.city, broadcasts: event.channelList)
                    }
                }
            }
            .eventPageInsets()
        }
        .eventSheet(GameBackdrop(home: tints.home, away: tints.away))
        .accessibilityIdentifier("page.game")
        .task(id: eventId) {
            tints = await TeamTint.pair(event.home, event.away)
        }
        .task(id: eventId) {
            // Asked when opened, with the table, so the page fills in one
            // go; then the game again each minute until it is over.
            async let first = store.detail(for: eventId)
            async let table = loadTable(standingsRef)
            (detail, standings) = await (first, table)
            withAnimation(.easeOut(duration: 0.25)) { ready = true }
            guard event.status.state != .final else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(60))
                if Task.isCancelled { return }
                if let fresh = await store.detail(for: eventId) { detail = fresh }
                // Until the whistle: a page opened before kickoff has to see
                // the game start to fetch its periods, stats and goals.
                guard event.status.state != .final else { return }
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

extension View {
    /// The room inside an event's card, round its blocks.
    func eventPageInsets() -> some View {
        self
            .padding(.horizontal, Metrics.gameInset)
            .padding(.top, Metrics.gameInset / 2)
            .padding(.bottom, Metrics.screenBottom)
    }

    /// An event's page — a game's or a race's — as the card over the page it
    /// was opened from: inset at the top and sides, running off the bottom,
    /// on its own backdrop, the page behind dimmed.
    func eventSheet(_ backdrop: some View) -> some View {
        self
            .background(backdrop)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: Metrics.gameRadius,
                                              topTrailingRadius: Metrics.gameRadius, style: .continuous))
            .padding([.top, .horizontal], Metrics.gameMargin)
            .ignoresSafeArea()
            .presentationBackground(Color.black.opacity(0.6))
    }
}

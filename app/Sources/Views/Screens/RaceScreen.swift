import SwiftUI

/// One race weekend, opened from its row: the same card over the page as a
/// game's (Julien, build 30), after Apple Sports' race card — the series and
/// the Grand Prix over the next session, then its blocks on panels.
///
/// - to come: the sprint's result and the starting grid once they are run,
///   the weekend's schedule, the championship table, when and where;
/// - classified: the podium, the full result, when and where.
struct RaceScreen: View {
    let eventId: String
    /// What the row showed when it was tapped, used until the store answers.
    let fallback: Event
    let store: ScoreboardStore
    @State private var standings: Standings?
    /// The championship has answered, for a race still to come.
    @State private var loaded = false

    /// Re-read from the store on every pass: the page outlives a refresh, so a
    /// race in progress keeps moving and portraits resolved later turn up.
    private var found: (event: Event, group: LeagueGroup)? { store.board?.find(eventId) }
    private var event: Event { found?.event ?? fallback }

    private var results: [RaceResult] { event.results ?? [] }
    private var classified: Bool { !results.filter(\.finished).isEmpty }

    /// The championship going into the race, when the series has one.
    private var standingsRef: LeagueRef? {
        guard let group = found?.group, group.league.hasStandings == true else { return nil }
        return LeagueRef(group: group)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Metrics.gameGap) {
                RaceHeaderSection(event: event, series: found?.group.league.name,
                                  now: store.board?.generatedAt ?? .now,
                                  frontRow: classified ? [] : Array((event.startingGrid ?? []).prefix(3)))
                if classified {
                    PodiumSection(results: results)
                    ResultSection(results: results)
                    GameInfoSection(start: event.start, venue: event.circuit, place: event.country, broadcasts: event.upcomingChannels)
                } else if !loaded {
                    // As a game's page: one loader under the header, then
                    // the schedule, the table and the place at once.
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 320)
                } else {
                    // Nothing classified yet: the sprint and the grid once
                    // Saturday has given them, as Apple Sports' race card,
                    // then the weekend ahead and the championship going in.
                    if let sprint = event.sprintResults {
                        ResultSection(results: sprint, title: "race.sprintResult")
                    }
                    if let grid = event.startingGrid {
                        StartingGridSection(results: grid)
                    }
                    if let sessions = event.sessions, !sessions.isEmpty {
                        SessionSection(sessions: sessions)
                    } else {
                        EmptyDay(title: Text("race.noSchedule"), line: nil)
                    }
                    if let ref = standingsRef {
                        StandingsSection(ref: ref, store: store, carded: true, preloaded: standings)
                    }
                    GameInfoSection(start: event.start, venue: event.circuit, place: event.country, broadcasts: event.upcomingChannels)
                }
            }
            .eventPageInsets()
        }
        .eventSheet(RaceBackdrop(tint: Color(hex: found?.group.league.color)))
        .accessibilityIdentifier("page.race")
        .task(id: eventId) {
            if let ref = standingsRef, !classified { standings = await store.standings(for: ref) }
            withAnimation(.easeOut(duration: 0.25)) { loaded = true }
        }
    }
}

/// The top of a race's page: the flag, the series and the Grand Prix in
/// grey, and under them what is next — "Qualifying · Sat 05:00" — or, once
/// it is run, the race's state. On the backdrop, not a panel, and holding
/// the remote as a game's header does.
struct RaceHeaderSection: View {
    let event: Event
    let series: String?
    /// The board's clock, so a bundled board reads right.
    let now: Date
    /// The grid's first three, once qualifying is run and the race is not.
    var frontRow: [RaceResult] = []

    /// The first session still to come, while the race itself is.
    private var next: Session? {
        guard event.status.state == .scheduled else { return nil }
        return (event.sessions ?? []).sorted { $0.start < $1.start }.first { $0.start >= now }
    }

    var body: some View {
        FocusBlock(identifier: "race.header", surface: false) {
            VStack(spacing: 22) {
                FlagMark(flag: event.flag, size: Metrics.markHero * 0.6)
                Text(verbatim: [series, event.name].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                if let next {
                    (Text(next.title) + Text(verbatim: " · ")
                        + Text(next.start, format: .dateTime.weekday(.abbreviated).hour().minute()))
                        .font(.body.weight(.semibold))
                } else {
                    StatusLabel(status: event.status, start: event.start)
                }
                if let channels = event.upcomingChannels { ChannelsLabel(channels: channels, limit: 3) }
                if !frontRow.isEmpty { front }
            }
        }
    }
}

extension RaceHeaderSection {
    /// "1 M. Verstappen" under each portrait, as Apple Sports' race card
    /// shows the grid before the lights go out.
    private var front: some View {
        HStack(spacing: Metrics.cardInsetH) {
            ForEach(frontRow) { r in
                VStack(spacing: Metrics.rowGap) {
                    PersonMark(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                               monogram: r.code ?? PersonMark.monogram(for: r.driver), size: Metrics.frontRowMark)
                    Text(verbatim: "\(r.pos ?? 0) \(r.driver)").font(.callout.weight(.semibold))
                }
            }
        }
        .padding(.top, Metrics.headingGap)
    }
}

/// Behind a race's page: the series' colour fading down to the dark, under
/// a faint chequered flag, as Apple Sports draws its race cards.
private struct RaceBackdrop: View {
    let tint: Color?

    var body: some View {
        ZStack {
            Color(white: 0.11)
            LinearGradient(stops: [.init(color: (tint ?? Color(white: 0.3)).opacity(0.55), location: 0),
                                   .init(color: .clear, location: 0.6)],
                           startPoint: .top, endPoint: .bottom)
            Canvas { context, size in
                let side: CGFloat = 96
                for row in 0...Int(size.height / side) {
                    for column in 0...Int(size.width / side) where (row + column).isMultiple(of: 2) {
                        context.fill(Path(CGRect(x: CGFloat(column) * side, y: CGFloat(row) * side,
                                                 width: side, height: side)),
                                     with: .color(.white.opacity(0.035)))
                    }
                }
            }
            .mask(LinearGradient(colors: [.white, .clear], startPoint: .top, endPoint: .bottom))
        }
    }
}

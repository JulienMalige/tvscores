import SwiftUI

/// One race weekend, opened from its row: the same card over the page as a
/// game's (Julien, build 30), after Apple Sports' race card — the series and
/// the Grand Prix over the next session, then its blocks on panels.
///
/// - to come: the weekend's schedule, the championship table, when and where;
/// - classified: the podium, the full result, when and where.
struct RaceScreen: View {
    let eventId: String
    /// What the row showed when it was tapped, used until the store answers.
    let fallback: Event
    let store: ScoreboardStore
    /// The series' colour behind the card, as its page is tinted.
    @State private var logoTint: Color?

    /// Re-read from the store on every pass: the page outlives a refresh, so a
    /// race in progress keeps moving and portraits resolved later turn up.
    private var found: (event: Event, group: LeagueGroup)? { store.board?.find(eventId) }
    private var event: Event { found?.event ?? fallback }

    private var results: [RaceResult] { event.results ?? [] }
    private var classified: Bool { !results.filter(\.finished).isEmpty }

    var body: some View {
        ScrollView {
            VStack(spacing: Metrics.gameGap) {
                RaceHeaderSection(event: event, series: found?.group.league.name,
                                  now: store.board?.generatedAt ?? .now)
                if classified {
                    PodiumSection(results: results)
                    ResultSection(results: results)
                } else {
                    // Nothing classified yet: the weekend ahead, when the
                    // feed has it, and the championship going into it.
                    if let sessions = event.sessions, !sessions.isEmpty {
                        SessionSection(sessions: sessions)
                    }
                    if let group = found?.group, group.league.hasStandings == true {
                        StandingsSection(ref: LeagueRef(group: group), store: store, carded: true)
                    }
                }
                GameInfoSection(start: event.start, venue: event.circuit, place: event.country)
            }
            .eventPageInsets()
        }
        .eventSheet(RaceBackdrop(tint: Color(hex: found?.group.league.color)))
        .accessibilityIdentifier("page.race")
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
            }
        }
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

import SwiftUI

/// A race weekend, as Apple Sports lists one. On the front page it is
/// compact — "Bahrain · Qualifying" in grey over the time, then the podium
/// once the race is classified. On the series' page it is the weekend's
/// schedule: the flag, the name and the circuit centred, then each session
/// with its day and time.
struct RaceRow: View {
    let event: Event
    /// The day this row is listed under: on a day with sessions but no
    /// race, the row shows those sessions rather than the race's own time.
    let day: Day
    /// What "today" is — the board's clock, so a bundled board reads right.
    var now: Date = .now
    /// On the series' own page: the weekend's whole schedule under its flag.
    var onPage = false
    @Environment(\.openGame) private var openGame

    var body: some View {
        Button {
            openGame(event)
        } label: {
            RaceRowContent(event: event, sessions: event.status.state == .scheduled ? event.sessions(on: day, now: now) : [], onPage: onPage)
        }
        .buttonStyle(QuietButtonStyle())
        .accessibilityIdentifier("race.\(event.id)")
    }
}

private struct RaceRowContent: View {
    let event: Event
    /// This day's sessions when the race itself is another day's.
    let sessions: [Session]
    let onPage: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: Metrics.headingGap) {
            if onPage { schedule } else { compact }
            podium
        }
        .rowSurface(focused: isFocused, resting: 0)
    }

    /// What is on this day: the sessions of it, or the race.
    private var shown: [Session] {
        sessions.isEmpty || sessions.contains(where: { $0.kind == "race" }) ? [] : sessions
    }

    @ViewBuilder
    private var compact: some View {
        if shown.isEmpty {
            VStack(spacing: 6) {
                caption(String(localized: "session.race"))
                StatusLabel(status: event.status, start: event.start)
                if let channels = event.upcomingChannels { ChannelsLabel(names: channels) }
            }
            .frame(maxWidth: .infinity)
        } else {
            ForEach(shown) { session in
                VStack(spacing: 6) {
                    caption(session.name)
                    Text(session.start, format: .dateTime.weekday(.wide).hour().minute())
                        .font(.title2.weight(.semibold))
                    // On a qualifying day too, not only the race's (build 34).
                    if let channels = event.upcomingChannels { ChannelsLabel(names: channels) }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func caption(_ what: String) -> some View {
        Text(verbatim: [event.name, what].compactMap { $0 }.joined(separator: " · "))
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
    }

    private var schedule: some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                FlagMark(flag: event.flag, size: Metrics.markHero * 0.6)
                Text(event.name ?? "").font(.headline)
                if let circuit = event.circuit {
                    Text(circuit).font(.callout).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, Metrics.headingGap)
            if event.status.state != .final {
                ForEach(event.sessions ?? []) { session in
                    RowRule()
                    HStack {
                        Text(session.name).font(.callout)
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(session.start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                                .font(.callout)
                            Text(session.start, format: .dateTime.hour().minute())
                                .font(.callout)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 12)
                }
            } else {
                StatusLabel(status: event.status, start: event.start)
            }
        }
    }

    @ViewBuilder
    private var podium: some View {
        let podium = (event.results ?? []).filter(\.finished).prefix(3)
        if !podium.isEmpty {
            HStack(spacing: 24) {
                ForEach(podium) { r in
                    HStack(spacing: 14) {
                        Text("\(r.pos ?? 0)")
                            .font(.system(size: 34, weight: .bold))
                        PersonMark(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                                   monogram: r.code ?? PersonMark.monogram(for: r.driver), size: Metrics.mark)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.driver).font(.callout.weight(.semibold))
                            Text(r.gap ?? r.team ?? "").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

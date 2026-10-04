import SwiftUI

/// A race weekend, as Apple Sports lists one. On the front page it is
/// compact — the flag over "Bahrain · Qualifying" in grey and the time,
/// then "Bahrain · Qualifying · Final" with the front row once it is run,
/// and the podium once the race is classified. On the series' own page it
/// is the day's part of the weekend under the flag, the name and the
/// circuit: that day's sessions and times, or what they gave.
struct RaceRow: View {
    let event: Event
    /// The day this row is listed under: on a day with sessions but no
    /// race, the row shows those sessions rather than the race's own time.
    let day: Day
    /// What "today" is — the board's clock, so a bundled board reads right.
    var now: Date = .now
    /// On the series' own page: the day's sessions under the flag.
    var onPage = false
    @Environment(\.openGame) private var openGame

    var body: some View {
        Button {
            openGame(event)
        } label: {
            RaceRowContent(event: event, day: day, now: now, onPage: onPage)
        }
        .buttonStyle(QuietButtonStyle())
        .accessibilityIdentifier("race.\(event.id)")
    }
}

private struct RaceRowContent: View {
    let event: Event
    let day: Day
    let now: Date
    let onPage: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: Metrics.headingGap) {
            if onPage {
                schedule
            } else {
                compact
                podium
            }
        }
        .rowSurface(focused: isFocused, resting: 0)
    }

    /// The weekend's sessions on this row's day; for Upcoming, those from
    /// tomorrow on.
    private var daySessions: [Session] { event.sessions(on: day, now: now) }

    /// The race is this day's — or the feed gave no timetable to say otherwise.
    private var raceDay: Bool {
        daySessions.isEmpty || daySessions.contains { $0.kind == "race" }
    }

    /// Qualifying or the sprint, classified on a day the race is not run.
    private var finished: SessionResult? {
        raceDay ? nil : event.latestSessionResult(on: day, now: now)
    }

    /// What is on this day when the race is not: its sessions, for the
    /// front page while they are still to come.
    private var shown: [Session] {
        raceDay || event.status.state != .scheduled ? [] : daySessions
    }

    /// The three at the top of whatever this day classified.
    private var podiumRows: [RaceResult] {
        // The race's own podium wherever the row speaks of the race.
        let rows = finished?.results ?? (shown.isEmpty ? event.results ?? [] : [])
        return Array(rows.filter(\.finished).prefix(3))
    }

    /// "Qualifying · Final".
    private func finalCaption(_ result: SessionResult) -> String {
        [result.session.localizedTitle, String(localized: "status.final", bundle: LanguageChoice.bundle)].joined(separator: " · ")
    }

    @ViewBuilder
    private var compact: some View {
        VStack(spacing: 6) {
            // The country's flag says which weekend it is, until a podium does.
            if podiumRows.isEmpty {
                FlagMark(flag: event.flag, size: Metrics.raceRowFlag)
            }
            if let finished {
                caption(finalCaption(finished))
                if let channels = event.channelList { ChannelsLabel(channels: channels) }
            } else if shown.isEmpty {
                caption(String(localized: "session.race", bundle: LanguageChoice.bundle))
                StatusLabel(status: event.status, start: event.start)
                if let channels = event.channelList { ChannelsLabel(channels: channels) }
            } else {
                ForEach(shown) { session in
                    VStack(spacing: 6) {
                        caption(session.name)
                        Text(session.start, format: .dateTime.weekday(.wide).hour().minute())
                            .font(.title2.weight(.semibold))
                        // On a qualifying day too, not only the race's (build 34).
                        if let channels = event.channelList { ChannelsLabel(channels: channels) }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func caption(_ what: String) -> some View {
        Text(verbatim: [event.name, what].compactMap { $0 }.joined(separator: " · "))
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
    }

    /// The day's sessions not yet classified: qualifying drops out of the
    /// list once its front row is shown.
    private var pending: [Session] {
        let done = Set((event.sessionResults ?? []).filter { !$0.results.isEmpty }.map(\.kind))
        return daySessions.filter { !done.contains($0.kind) }
    }

    /// The series' page: one day of the weekend under its flag (Julien,
    /// 2026-10-03), the whole timetable being the race page's.
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
            if let finished {
                Text(verbatim: finalCaption(finished))
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.bottom, Metrics.headingGap)
                podium
            }
            if raceDay && event.status.state == .final {
                StatusLabel(status: event.status, start: event.start)
                    .padding(.bottom, Metrics.headingGap)
                podium
            } else {
                ForEach(pending) { session in
                    RowRule()
                    HStack {
                        Text(session.title).font(.callout)
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
                if pending.isEmpty && finished == nil {
                    StatusLabel(status: event.status, start: event.start)
                }
                if let channels = event.channelList {
                    ChannelsLabel(channels: channels)
                        .padding(.top, Metrics.headingGap)
                }
            }
        }
    }

    @ViewBuilder
    private var podium: some View {
        if !podiumRows.isEmpty {
            HStack(spacing: 24) {
                ForEach(podiumRows) { r in
                    HStack(spacing: 14) {
                        Text("\(r.pos ?? 0)")
                            .font(.system(size: 34, weight: .bold))
                        PersonMark(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                                   monogram: r.code ?? PersonMark.monogram(for: r.driver), size: Metrics.mark)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.driver).font(.callout.weight(.semibold))
                            // Qualifying gives each its lap; a race or a sprint the gap.
                            Text(r.time ?? r.gap ?? r.team ?? "").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }
}

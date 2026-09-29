import SwiftUI

/// The middle of a row: kickoff time before, clock during, "Final" after.
/// It is the one element every kind of row shares.
struct StatusLabel: View {
    let status: Status
    let start: Date
    /// A list row's middle, smaller than its scores as Apple Sports sets it;
    /// a game's page keeps the larger size.
    var compact = false

    /// Under a date heading the day is said already: the time alone.
    @Environment(\.underDayHeading) private var underDayHeading
    /// The board's own clock: a bundled board from September is not a day
    /// of games all overdue (CI, build 29).
    @Environment(\.boardNow) private var boardNow

    /// Apple Sports' sizes doubled (docs/design-measures.md): a list's
    /// "Final" and kickoff at the row's text size, a game page's a little less.
    private var mainFont: Font { compact ? .callout.weight(.semibold) : .body.weight(.semibold) }

    var body: some View {
        VStack(spacing: 4) {
            switch status.state {
            case .scheduled where start.timeIntervalSince(boardNow ?? .now) < -overdue:
                // Long past its start with no word from the feed: a time
                // here read as a game still to come, at six in the evening
                // for a match of three in the morning (Julien, build 28).
                Text("status.awaiting")
                    .font(mainFont)
                    .foregroundStyle(.secondary)
            case .scheduled:
                if !underDayHeading, !Calendar.current.isDateInToday(start) {
                    Text(start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Text(start, format: .dateTime.hour().minute())
                    .font(mainFont)
                if let d = status.detail { detailText(d) }
            case .live:
                Text(status.clock ?? localizedDetail(status.note) ?? localizedDetail(status.detail) ?? String(localized: "status.live"))
                    .font(mainFont)
                    .foregroundStyle(status.note == nil ? .green : .orange)
                if status.clock != nil || status.note != nil, let d = status.detail { detailText(d) }
            case .final:
                Text(finalText)
                    .font(mainFont)
                // "Final/OT" says it on one line; anything else keeps its own.
                if let d = status.detail, Self.finalCombined[d] == nil { detailText(d) }
            case .other:
                Text(localizedDetail(status.detail) ?? "–")
                    .font(mainFont)
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// The sport, for how long a game may run late: a tennis match's time is
    /// often when play on its court begins, and the third on a court starts
    /// hours after it (review, build 29).
    var sport: String? = nil

    /// How long after its start a game with no news stops showing its time.
    private var overdue: TimeInterval { (sport == "tennis" ? 10 : 3) * 3600 }

    /// Endings worth folding into the "Final" line rather than printing below it.
    static let finalCombined: [String: String] = [
        "After overtime": "status.final.ot",
        "After extra time": "status.final.aet",
        "After penalties": "status.final.pen",
    ]

    private var finalText: String {
        if let d = status.detail, let key = Self.finalCombined[d] {
            return String(localized: String.LocalizationValue(key))
        }
        return String(localized: "status.final")
    }

    private func detailText(_ d: String) -> some View {
        Text(localizedDetail(d) ?? d)
            .font(.callout)
            .foregroundStyle(.secondary)
    }

    /// The proxy sends English detail strings; map the known ones to the catalog.
    /// Built once: a dictionary literal traps at runtime if a key is repeated.
    static let detailKeys: [String: String] = [
        "Half-time": "status.halftime",
        "Extra time": "status.extratime",
        "Penalties": "status.penalties",
        "After extra time": "status.aet",
        "After penalties": "status.apen",
        "After overtime": "status.aot",
        "Postponed": "status.postponed",
        "Cancelled": "status.cancelled",
        "Suspended": "status.suspended",
        "Interrupted": "status.interrupted",
        "Abandoned": "status.abandoned",
        "Time TBD": "status.tbd",
        "Race": "status.race",
        "Break": "status.break",
        "Awarded": "status.awarded",
        "Walkover": "status.walkover",
        "No update": "status.noupdate",
    ]

    private func localizedDetail(_ d: String?) -> String? {
        guard let d else { return nil }
        guard let key = Self.detailKeys[d] else { return d }
        return String(localized: String.LocalizationValue(key))
    }
}

extension EnvironmentValues {
    /// Rows listed under a heading naming their day ("Sat, 3 Oct").
    @Entry var underDayHeading = false
    /// When the board on screen was made.
    @Entry var boardNow: Date? = nil
}

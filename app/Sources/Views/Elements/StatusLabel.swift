import SwiftUI

/// The middle of a row: kickoff time before, clock during, "Final" after.
/// It is the one element every kind of row shares.
struct StatusLabel: View {
    let status: Status
    let start: Date

    var body: some View {
        VStack(spacing: 4) {
            switch status.state {
            case .scheduled:
                if !Calendar.current.isDateInToday(start) {
                    Text(start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Text(start, format: .dateTime.hour().minute())
                    .font(.title2.weight(.semibold))
                if let d = status.detail { detailText(d) }
            case .live:
                Text(status.clock ?? localizedDetail(status.note) ?? localizedDetail(status.detail) ?? String(localized: "status.live"))
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(status.note == nil ? .green : .orange)
                if status.clock != nil || status.note != nil, let d = status.detail { detailText(d) }
            case .final:
                Text(finalText)
                    .font(.title2.weight(.semibold))
                // "Final/OT" says it on one line; anything else keeps its own.
                if let d = status.detail, Self.finalCombined[d] == nil { detailText(d) }
            case .other:
                Text(localizedDetail(status.detail) ?? "–")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// Endings worth folding into the "Final" line rather than printing below it.
    private static let finalCombined: [String: String] = [
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
    private static let detailKeys: [String: String] = [
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
    ]

    private func localizedDetail(_ d: String?) -> String? {
        guard let d else { return nil }
        guard let key = Self.detailKeys[d] else { return d }
        return String(localized: String.LocalizationValue(key))
    }
}

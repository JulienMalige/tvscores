import SwiftUI

/// Where a game is on — "Canal+ · beIN Sports 1" — in small grey type
/// under its time (Julien, build 33). Names only, never a link. A row has
/// room for two; the rest are counted, and the game's page lists them all.
struct ChannelsLabel: View {
    let names: [String]
    var limit = 2

    var body: some View {
        Text(verbatim: Self.line(names, limit: limit))
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
    }

    static func line(_ names: [String], limit: Int) -> String {
        let shown = names.prefix(limit).joined(separator: " · ")
        return names.count > limit ? "\(shown) +\(names.count - limit)" : shown
    }
}

extension Event {
    /// The channels to show beside a game still to be played or under way,
    /// in the countries chosen in Settings; once it is over, where it was on
    /// no longer helps. With several countries, each name carries its flag:
    /// "🇫🇷 Canal+", "🇺🇸 Peacock".
    @MainActor
    var upcomingChannels: [String]? {
        guard status.state != .final else { return nil }
        let chosen = ChannelChoice.shared.countries
        let byCountry = broadcastsBy ?? (broadcasts.map { ["FR": $0] } ?? [:])
        let flagged = chosen.count > 1
        let names = chosen.flatMap { country in
            (byCountry[country] ?? []).map { flagged ? "\(ChannelChoice.flag(country)) \($0)" : $0 }
        }
        return names.isEmpty ? nil : names
    }
}

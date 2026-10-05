import SwiftUI

/// One channel a game is on, and the country it is on there when the viewer
/// follows more than one (Settings, build 36).
struct Channel: Hashable {
    /// "FR", "US", "BR"; nil when only one country is chosen.
    let country: String?
    let name: String
    /// An app that is the same in every country chosen: a globe, not a flag.
    var worldwide = false
}

/// Where a game is on — "Canal+ · beIN Sports 1" — in small grey type
/// under its time (Julien, build 33). Names only, never a link. With several
/// countries, each country's channels follow its flag as a small round
/// mark, as a driver's flag sits on his portrait (Julien, build 36). A row
/// has room for two; the rest are counted, and the game's page lists them all.
struct ChannelsLabel: View {
    let channels: [Channel]
    var limit = 2
    var font: Font = .caption
    var color: Color = .secondary

    private var shown: [Channel] { Array(channels.prefix(limit)) }

    var body: some View {
        HStack(spacing: 10) {
            ForEach(Array(groups.enumerated()), id: \.offset) { _, group in
                HStack(spacing: 8) {
                    if group.worldwide {
                        Image(systemName: "globe").font(.system(size: Metrics.channelFlag * 0.8))
                    } else if let country = group.country {
                        FlagMark(flag: ChannelChoice.flag(country), size: Metrics.channelFlag)
                    }
                    Text(verbatim: group.names.joined(separator: " · "))
                }
            }
            if channels.count > limit {
                Text(verbatim: "+\(channels.count - limit)")
            }
        }
        .font(font)
        .foregroundStyle(color)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    /// Neighbouring channels of one country, under one flag.
    private var groups: [(country: String?, worldwide: Bool, names: [String])] {
        var out: [(country: String?, worldwide: Bool, names: [String])] = []
        for c in shown {
            if let last = out.last, last.country == c.country, last.worldwide == c.worldwide {
                out[out.count - 1].names.append(c.name)
            } else {
                out.append((c.country, c.worldwide, [c.name]))
            }
        }
        return out
    }
}

extension Event {
    /// The channels to show beside a game, in the countries chosen in Settings:
    /// where it is on, and once it is over where it was (Julien, 2026-10-04:
    /// "on a finished game, you could also show the channel").
    @MainActor
    var channelList: [Channel]? {
        let chosen = ChannelChoice.shared.countries
        let byCountry = broadcastsBy ?? (broadcasts.map { ["FR": $0] } ?? [:])
        let several = chosen.count > 1
        let channels = chosen.flatMap { country in
            (byCountry[country] ?? []).map { Channel(country: several ? country : nil, name: $0) }
        }
        return channels.isEmpty ? nil : channels
    }
}

import SwiftUI

/// When and where, as Apple Sports closes its game pages: a centred title,
/// then "Time:" and "Location:" in grey before their values — a game's
/// venue and town, or a race's circuit and country — and, before it is
/// over, the channels it is on.
struct GameInfoSection: View {
    let start: Date
    let venue: String?
    let place: String?
    /// Where it is on, every channel, while that still helps.
    var broadcasts: [Channel]? = nil

    private var location: String? {
        let parts = [venue, place].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: ", ")
    }

    var body: some View {
        FocusBlock(identifier: "game.information", surface: false) {
            VStack(alignment: .leading, spacing: 16) {
                Text("game.information")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, 6)
                InfoLine(symbol: "clock", label: "game.time", value: Text(start, format: .dateTime.weekday(.wide).day().month(.wide).hour().minute()))
                if let location {
                    InfoLine(symbol: "mappin.and.ellipse", label: "game.location", value: Text(verbatim: location))
                }
                if let broadcasts, !broadcasts.isEmpty {
                    HStack(spacing: 14) {
                        Image(systemName: "tv").foregroundStyle(.secondary)
                        Text("game.watchOn").foregroundStyle(.secondary)
                        ChannelsLabel(channels: broadcasts, limit: broadcasts.count, font: .callout, color: .primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .font(.callout)
        }
    }
}

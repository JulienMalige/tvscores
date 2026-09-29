import SwiftUI

/// When and where, as Apple Sports closes its game pages: a centred title,
/// then "Time:" and "Location:" in grey before their values — a game's
/// venue and town, or a race's circuit and country.
struct GameInfoSection: View {
    let start: Date
    let venue: String?
    let place: String?

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
                line("clock", "game.time", Text(start, format: .dateTime.weekday(.wide).day().month(.wide).hour().minute()))
                if let location {
                    line("mappin.and.ellipse", "game.location", Text(verbatim: location))
                }
            }
            .font(.callout)
        }
    }

    private func line(_ symbol: String, _ label: LocalizedStringKey, _ value: Text) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).foregroundStyle(.secondary)
            Text(label).foregroundStyle(.secondary) + Text(verbatim: " ") + value
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

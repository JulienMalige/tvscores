import SwiftUI

/// When and where: the start in the viewer's time, and the venue with its
/// town — a game's, or a race's circuit and country.
struct GameInfoSection: View {
    let start: Date
    let venue: String?
    let place: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text("game.information").font(.title2.weight(.bold))
            FocusBlock(identifier: "game.information") {
                VStack(alignment: .leading, spacing: 14) {
                    Label {
                        Text(start, format: .dateTime.weekday(.wide).day().month(.wide).hour().minute())
                    } icon: {
                        Image(systemName: "clock")
                    }
                    if let where_ = [venue, place].compactMap({ $0 }).filter({ !$0.isEmpty }).joined(separator: ", ").nilIfEmpty {
                        Label {
                            Text(verbatim: where_)
                        } icon: {
                            Image(systemName: "mappin.and.ellipse")
                        }
                    }
                }
                .font(.title3)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

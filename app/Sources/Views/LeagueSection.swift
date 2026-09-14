import SwiftUI

struct LeagueSection: View {
    let group: LeagueGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                LeagueMark(sport: group.sport, logo: group.league.logo)
                Text(group.league.name)
                    .font(.title3.weight(.semibold))
            }
            .padding(.leading, 8)
            VStack(spacing: 4) {
                ForEach(group.events) { event in
                    switch event.kind {
                    case .match: MatchRow(event: event)
                    case .race: RaceRow(event: event)
                    }
                }
            }
        }
    }
}

/// Official competition logo when the proxy has one, else the sport's symbol.
struct LeagueMark: View {
    let sport: String
    let logo: URL?

    var body: some View {
        Group {
            if let logo {
                AsyncImage(url: logo) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit()
                    } else {
                        symbol
                    }
                }
            } else {
                symbol
            }
        }
        // Wide marks (F1, MotoGP, ATP) get room; square badges stay compact.
        .frame(maxWidth: 132, minHeight: 52, maxHeight: 52)
    }

    private var symbol: some View {
        Image(systemName: Sport.icon(for: sport))
            .font(.title3)
            .foregroundStyle(Sport.tint(for: sport))
    }
}

enum Sport {
    static func icon(for sport: String) -> String {
        switch sport {
        case "football": "soccerball"
        case "nfl": "football"
        case "nba": "basketball"
        case "f1": "flag.checkered"
        case "motogp": "flag.checkered.2.crossed"
        case "tennis": "tennisball"
        default: "sportscourt"
        }
    }

    static func tint(for sport: String) -> Color {
        switch sport {
        case "football": .blue
        case "nfl": .brown
        case "nba": .orange
        case "f1": .red
        case "motogp": .orange
        case "tennis": .green
        default: .secondary
        }
    }
}

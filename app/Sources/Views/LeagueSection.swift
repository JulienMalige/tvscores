import SwiftUI

struct LeagueSection: View {
    let group: LeagueGroup

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: Sport.icon(for: group.sport))
                    .foregroundStyle(Sport.tint(for: group.sport))
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

enum Sport {
    static func icon(for sport: String) -> String {
        switch sport {
        case "football": "soccerball"
        case "nfl": "football"
        case "nba": "basketball"
        case "f1": "flag.checkered"
        default: "sportscourt"
        }
    }

    static func tint(for sport: String) -> Color {
        switch sport {
        case "football": .blue
        case "nfl": .brown
        case "nba": .orange
        case "f1": .red
        default: .secondary
        }
    }
}

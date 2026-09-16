import SwiftUI

/// Official competition logo when the proxy has one, else the sport's symbol.
struct LeagueMark: View {
    let sport: String
    let logo: URL?
    /// A square to fit inside. Left out, the mark takes the width a wordmark
    /// needs, which is right in a heading and wrong in a list of icons.
    var square: CGFloat? = nil

    var body: some View {
        Group {
            if let logo {
                CachedImage(url: logo) { symbol }
            } else {
                symbol
            }
        }
        .modifier(Box(square: square))
    }

    /// Two shapes, one mark: a heading gives a wordmark its width; a sidebar
    /// gives every competition the same square, whatever shape its mark is.
    private struct Box: ViewModifier {
        let square: CGFloat?

        func body(content: Content) -> some View {
            if let square {
                content.frame(width: square, height: square)
            } else {
                // Wide marks (F1, MotoGP, ATP) get room; square badges stay compact.
                content.frame(maxWidth: Metrics.leagueMark * 2.5, minHeight: Metrics.leagueMark, maxHeight: Metrics.leagueMark)
            }
        }
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

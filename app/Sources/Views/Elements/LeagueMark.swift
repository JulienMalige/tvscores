import SwiftUI

/// Official competition logo when the proxy has one, else its symbol or the sport's.
struct LeagueMark: View {
    let sport: String
    let logo: URL?
    /// The proxy's symbol for a competition without a mark worth showing.
    var symbolName: String? = nil
    /// A square to fit inside. Left out, the mark takes the width a wordmark
    /// needs, which is right in a heading and wrong in a list of icons.
    var square: CGFloat? = nil
    /// The height a wordmark gets when it is not squared: the page's title
    /// takes the full size, a list's heading less.
    var height: CGFloat = Metrics.leagueMark

    var body: some View {
        Group {
            if let logo {
                CachedImage(url: logo) { symbol }
            } else {
                symbol
            }
        }
        .modifier(Box(square: square, height: height))
    }

    /// Two shapes, one mark: a heading gives a wordmark its width; a sidebar
    /// gives every competition the same square, whatever shape its mark is.
    private struct Box: ViewModifier {
        let square: CGFloat?
        let height: CGFloat

        func body(content: Content) -> some View {
            if let square {
                content.frame(width: square, height: square)
            } else {
                // As wide as the mark itself at this height, no wider: a box
                // sized for the widest wordmark left a gap between the NBA's
                // narrow logo and its name (Julien, build 29).
                content
                    .frame(height: height)
                    .fixedSize(horizontal: true, vertical: false)
                    // As wide as it is tall while it loads, so the name
                    // beside it does not jump when the mark arrives.
                    .frame(minWidth: height, alignment: .leading)
            }
        }
    }

    private var symbol: some View {
        Image(systemName: symbolName ?? Sport.icon(for: sport))
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

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
        // Read for its change alone: the logo's shape is known once it lands.
        let _ = ImageArrivals.shared.count
        return Group {
            if let logo {
                CachedImage(url: logo) { symbol }
            } else {
                symbol
            }
        }
        .modifier(Box(square: square, height: height, size: logo
            .flatMap { ImageCache.shared.image(for: $0)?.size }
            .map { Self.size(aspect: $0.width / max($0.height, 1), nominal: height) }))
    }

    /// The box a mark of this shape gets, so that a wide wordmark and a tall
    /// badge look the same size: equal area, within bounds, as Apple Sports
    /// sets its competition marks.
    static func size(aspect: CGFloat, nominal: CGFloat) -> CGSize {
        guard aspect > 0 else { return CGSize(width: nominal, height: nominal) }
        let area = nominal * nominal * Metrics.leagueMarkArea
        var height = min(max((area / aspect).squareRoot(), nominal * Metrics.leagueMarkShortest),
                         nominal * Metrics.leagueMarkTallest)
        var width = height * aspect
        if width > nominal * Metrics.leagueMarkWidest {
            width = nominal * Metrics.leagueMarkWidest
            height = width / aspect
        }
        return CGSize(width: width.rounded(), height: height.rounded())
    }

    /// Two shapes, one mark: a heading gives a wordmark its width; a sidebar
    /// gives every competition the same square, whatever shape its mark is.
    private struct Box: ViewModifier {
        let square: CGFloat?
        let height: CGFloat
        /// The mark's own box, once its picture is here to measure.
        let size: CGSize?

        func body(content: Content) -> some View {
            if let square {
                content.frame(width: square, height: square)
            } else if let size {
                content.frame(width: size.width, height: size.height)
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

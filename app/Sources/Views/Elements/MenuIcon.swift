import SwiftUI

/// What stands before a row's name: a system symbol, or a competition's mark.
enum MenuIcon {
    case symbol(String)
    case league(LeagueSummary)

    /// The picture for a competition: its square icon; failing that its
    /// symbol, when it has one, over a wordmark that is an unreadable strip
    /// at this size (the friendlies', Julien, build 47); failing both, its
    /// logo. Nil draws the symbol.
    static func mark(of league: LeagueSummary) -> URL? {
        league.icon ?? (league.symbol == nil ? league.logo : nil)
    }

    @ViewBuilder
    func view(size: CGFloat) -> some View {
        switch self {
        case .symbol(let name):
            Image(systemName: name)
                // Medium, as Apple Sports draws its menu's symbols.
                .font(.system(size: size * 0.7, weight: .medium))
                .frame(width: size, height: size)
        case .league(let league):
            CachedImage(url: Self.mark(of: league)) {
                Image(systemName: league.symbol ?? Sport.icon(for: league.sport))
                    .font(.system(size: size * 0.6))
                    .foregroundStyle(Sport.tint(for: league.sport))
            }
            .frame(width: size, height: size)
        }
    }
}

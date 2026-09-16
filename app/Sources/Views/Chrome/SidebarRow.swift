import SwiftUI

/// One competition in the sidebar, shaped the way tvOS shapes its own.
///
/// Every entry of the system sidebar — Apple TV, MLS, Disney+ — puts its mark
/// inside the same round container, so a wordmark and a crest sit on one
/// vertical line and no logo is larger than its neighbour. Ours does the same,
/// and it is the treatment the constructor badges already use.
struct SidebarRow: View {
    let league: LeagueSummary

    /// The container, matching the system's own sidebar icons.
    private static let disc: CGFloat = 56

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                FadingText(league.name)
                if !league.playing {
                    Text("sidebar.noGames")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        } icon: {
            LeagueMark(sport: league.sport, logo: league.logo)
                // Fit inside the disc, never filled to it: a wide wordmark
                // keeps its proportions and a square badge keeps its size.
                .padding(Self.disc * 0.14)
                .frame(width: Self.disc, height: Self.disc)
                .background(Circle().fill(Color.white.opacity(0.10)))
        }
    }
}

/// A line of text that runs out rather than ending in an ellipsis.
///
/// Julien, on a truncated competition name: "shorten but not by …, it's
/// fading out" — which is what tvOS does to the sidebar entry it cannot fit.
struct FadingText: View {
    private let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .lineLimit(1)
            // Lay the whole line out and let the row clip it, so the mask has
            // something to fade; truncation would have eaten the tail first.
            .fixedSize(horizontal: true, vertical: false)
            .mask(
                LinearGradient(
                    stops: [.init(color: .black, location: 0.86), .init(color: .clear, location: 1)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }
}

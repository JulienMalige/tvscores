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
            // The proxy composes this one: a square icon with the mark already
            // centred on its own ground. tvOS lays sidebar icons out itself and
            // discards the frame we put round them — a wide wordmark sent as-is
            // came out towering over the crest beside it and over its own name.
            LeagueMark(sport: league.sport, logo: league.icon ?? league.logo, square: Self.disc)
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
            .truncationMode(.tail)
            // `fixedSize` was tried first, to lay the whole line out and let
            // the row clip it. The sidebar re-proposes its own width and the
            // name wrapped to two lines instead, so the line is truncated and
            // the mask fades the last of it — the ellipsis included.
            .mask(
                LinearGradient(
                    stops: [.init(color: .black, location: 0.86), .init(color: .clear, location: 1)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }
}

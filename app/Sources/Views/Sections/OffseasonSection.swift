import SwiftUI

/// A competition with nothing this week, and when it is back.
///
/// Focusable, though there is nothing to do with it: a page that is only
/// this card has nothing else the remote can land on, and a page with
/// nothing to land on is a dead remote — the television's trace showed
/// Julien quitting the app twice to get out of Copa Libertadores.
struct OffseasonSection: View {
    let ref: LeagueRef
    let next: NextGame
    @FocusState private var isFocused: Bool

    /// A break shorter than this is "coming up", with the day; longer is an
    /// off-season, with the month. Six weeks: longer than any gap in a
    /// season's calendar, shorter than the shortest off-season we follow.
    private static let offseasonFrom: TimeInterval = 45 * 86400

    private var soon: Bool { next.start.timeIntervalSinceNow < Self.offseasonFrom }

    var body: some View {
        VStack(spacing: 10) {
            Text(soon ? "offseason.soonTitle" : "offseason.title")
                .font(.title2.weight(.bold))
            Text(sentence)
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous).fill(Color.white.opacity(isFocused ? 0.1 : 0.04)))
        .scaleEffect(isFocused ? 1.01 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier("offseason")
    }

    /// "NBA returns in October for the 2026–2027 season." — or, within a
    /// few weeks, the day itself.
    private var sentence: String {
        if soon {
            let day = next.start.formatted(.dateTime.weekday(.wide).day().month(.wide))
            return String(format: String(localized: "offseason.date"), ref.name, day)
        }
        let month = next.start.formatted(.dateTime.month(.wide))
        if let season = next.season?.replacingOccurrences(of: "-", with: "–") {
            return String(format: String(localized: "offseason.monthSeason"), ref.name, month, season)
        }
        return String(format: String(localized: "offseason.month"), ref.name, month)
    }
}

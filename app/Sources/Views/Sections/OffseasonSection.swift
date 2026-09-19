import SwiftUI

/// A competition with nothing this week, and when it is back.
struct OffseasonSection: View {
    let ref: LeagueRef
    let next: NextGame

    var body: some View {
        VStack(spacing: 10) {
            Text("offseason.title")
                .font(.title2.weight(.bold))
            Text(sentence)
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .background(RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous).fill(Color.white.opacity(0.04)))
        .accessibilityIdentifier("offseason")
    }

    /// "NBA returns in October for the 2026–2027 season." — or, within a
    /// few weeks, the day itself.
    private var sentence: String {
        let soon = next.start.timeIntervalSinceNow < 45 * 86400
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

import SwiftUI

/// One statistic: the home value, its name, the away value, and under them
/// two bars sharing the width in proportion, each in its side's colour.
struct StatRow: View {
    let stat: GameDetail.Stat
    var homeTint: Color?
    var awayTint: Color?

    var body: some View {
        VStack(spacing: 8) {
            HStack(alignment: .lastTextBaseline) {
                value(stat.home)
                Spacer()
                Text(LocalizedStringKey("stat." + stat.id))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                value(stat.away)
            }
            GeometryReader { geo in
                let total = stat.home + stat.away
                let share = total > 0 ? stat.home / total : 0.5
                HStack(spacing: 8) {
                    Capsule().fill(homeTint ?? Color.white.opacity(0.85))
                        .frame(width: (geo.size.width - 8) * share)
                    Capsule().fill(awayTint ?? Color.white.opacity(0.4))
                }
            }
            .frame(height: 10)
        }
    }

    private func value(_ v: Double) -> some View {
        let text = v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
        return Text(verbatim: stat.isPercent ? text + "%" : text)
            .font(.system(size: Metrics.statValue, weight: .bold).width(.condensed))
            .monospacedDigit()
    }
}

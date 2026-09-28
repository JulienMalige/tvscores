import SwiftUI

/// One statistic: the home value, its name, the away value, and under them
/// two bars sharing the width in proportion — the larger side bright.
struct StatRow: View {
    let stat: GameDetail.Stat

    var body: some View {
        FocusBlock {
            VStack(spacing: 10) {
                HStack {
                    value(stat.home)
                    Spacer()
                    Text(LocalizedStringKey("stat." + stat.id))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Spacer()
                    value(stat.away)
                }
                GeometryReader { geo in
                    let total = max(stat.home + stat.away, 1)
                    let share = stat.home / total
                    HStack(spacing: 6) {
                        Capsule().fill(Color.white.opacity(stat.home >= stat.away ? 0.9 : 0.35))
                            .frame(width: max((geo.size.width - 6) * share, 4))
                        Capsule().fill(Color.white.opacity(stat.away >= stat.home ? 0.9 : 0.35))
                    }
                }
                .frame(height: 8)
            }
        }
    }

    private func value(_ v: Double) -> some View {
        let text = v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
        return Text(verbatim: stat.isPercent ? text + "%" : text)
            .font(.system(size: 30, weight: .bold, design: .rounded))
            .monospacedDigit()
    }
}

import SwiftUI

/// The three who finished on the box, blown up: this is the one place a mark is
/// the subject rather than a label, so it uses the hero size.
struct PodiumSection: View {
    let results: [RaceResult]

    var body: some View {
        HStack(spacing: 24) {
            ForEach(results.filter(\.finished).prefix(3)) { r in
                VStack(spacing: 10) {
                    PersonMark(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                               monogram: r.code ?? PersonMark.monogram(for: r.driver), size: Metrics.markHero)
                    Text("\(r.pos ?? 0)")
                        .font(.system(size: 30, weight: .bold, design: .rounded))
                    Text(r.driver).font(.title3.weight(.semibold))
                    Text(r.gap ?? "").font(.callout).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 28)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 24, style: .continuous).fill(Color.white.opacity(0.06)))
    }
}

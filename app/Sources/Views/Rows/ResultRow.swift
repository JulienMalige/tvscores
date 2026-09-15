import SwiftUI

/// One line of a race classification: place, driver, grid slot, points, gap.
///
/// A plain `.focusable()` view takes focus — the page scrolls, the TV clicks —
/// but it does not publish `\.isFocused` to its own body the way a button
/// publishes it to its label, so the highlight never appeared. `@FocusState`
/// is told directly instead, which works inside a single view.
struct ResultRow: View {
    let result: RaceResult
    @FocusState private var isFocused: Bool

    /// Shared with the column titles above the list.
    static let nameWidth: CGFloat = 640
    static let numberWidth: CGFloat = 160

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: Metrics.headingGap) {
                Text(result.pos.map { String($0) } ?? "–")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .frame(width: 60, alignment: .trailing)
                PersonMark(photo: result.photo, flag: result.flag, color: Color(hex: result.teamColor),
                           monogram: result.code ?? PersonMark.monogram(for: result.driver), size: Metrics.mark)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 10) {
                        Text(result.driver).font(.title3.weight(.semibold))
                        if result.fastestLap == true {
                            Image(systemName: "stopwatch")
                                .font(.callout)
                                .foregroundStyle(.purple)
                                .accessibilityLabel(Text("race.fastestLap"))
                        }
                    }
                    Text(result.team ?? "").font(.callout).foregroundStyle(.secondary)
                }
            }
            .frame(width: Self.nameWidth, alignment: .leading)
            Text(result.grid.map { String($0) } ?? "")
                .frame(width: Self.numberWidth, alignment: .trailing)
            // A blank reads better than a column of zeros for the non-scorers.
            Text((result.points ?? 0) > 0 ? String(result.points ?? 0) : "")
                .frame(width: Self.numberWidth, alignment: .trailing)
            Text(result.gap ?? "")
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.title3)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .rowSurface(focused: isFocused)
        // tvOS scrolls by moving focus. Without this the page would be stuck
        // at the top and most of the field unreachable.
        .focusable()
        .focused($isFocused)
    }
}

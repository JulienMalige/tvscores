import SwiftUI

/// One slot of a starting grid: place, portrait, driver over team. A
/// result row without its columns, since nothing has been raced yet.
///
/// Focusable through `@FocusState`, as `ResultRow` is, so the remote can
/// walk the page down to the back of the grid.
struct StartingGridRow: View {
    let result: RaceResult
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: Metrics.headingGap) {
            Text(result.pos.map { String($0) } ?? "–")
                .font(.callout.weight(.bold))
                .frame(width: Metrics.placeWidth, alignment: .trailing)
            PersonMark(photo: result.photo, flag: result.flag, color: Color(hex: result.teamColor),
                       monogram: result.code ?? PersonMark.monogram(for: result.driver), size: Metrics.tableMark * 1.2)
            VStack(alignment: .leading, spacing: 2) {
                Text(result.driver).font(.callout.weight(.semibold))
                Text(result.team ?? "").font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .font(.callout)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .rowSurface(focused: isFocused, resting: 0, insetV: Metrics.tableRowPad)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier("grid.\(result.pos.map(String.init) ?? "-")")
    }
}

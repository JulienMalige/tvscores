import SwiftUI

/// The full classification: column titles, everyone who was running at the end,
/// then the retirements under their own heading.
struct ResultSection: View {
    let results: [RaceResult]
    /// "Race Result", or "Sprint Result" for the Saturday race.
    var title: LocalizedStringKey = "race.result"

    private var finishers: [RaceResult] { results.filter(\.finished) }
    private var retired: [RaceResult] { results.filter { !$0.finished } }
    /// A sprint's feed gives no grid: no "Start" column of blanks (build 34).
    private var showsGrid: Bool { results.contains { $0.grid != nil } }

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text(title)
                .font(.callout.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.bottom, Metrics.cardGap - Metrics.rowGap)
            columnTitles
            ForEach(finishers) { ResultRow(result: $0, showsGrid: showsGrid) }
            if !retired.isEmpty {
                Text("race.retired")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, Metrics.headingGap)
                ForEach(retired) { ResultRow(result: $0, showsGrid: showsGrid) }
            }
        }
        // On a panel, as a game's table is.
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, 16)
        .gameCardSurface(radius: Metrics.gameCardRadius)
    }

    /// Aligned with the rows below by sharing their inset and column widths.
    private var columnTitles: some View {
        HStack(spacing: 0) {
            Text("race.driver").frame(width: ResultRow.nameWidth, alignment: .leading)
            if showsGrid {
                Text("race.start").frame(width: ResultRow.numberWidth, alignment: .trailing)
            }
            Text("race.points").frame(width: ResultRow.numberWidth, alignment: .trailing)
            Text("race.gap").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .padding(.horizontal, Metrics.rowInsetH)
    }
}

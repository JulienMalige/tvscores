import SwiftUI

/// The full classification: column titles, everyone who was running at the end,
/// then the retirements under their own heading.
struct ResultSection: View {
    let results: [RaceResult]

    private var finishers: [RaceResult] { results.filter(\.finished) }
    private var retired: [RaceResult] { results.filter { !$0.finished } }

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.rowGap) {
            Text("race.result").font(.title3.weight(.semibold))
            columnTitles
            ForEach(finishers) { ResultRow(result: $0) }
            if !retired.isEmpty {
                Text("race.retired")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, Metrics.headingGap)
                ForEach(retired) { ResultRow(result: $0) }
            }
        }
    }

    /// Aligned with the rows below by sharing their inset and column widths.
    private var columnTitles: some View {
        HStack(spacing: 0) {
            Text("race.driver").frame(width: ResultRow.nameWidth, alignment: .leading)
            Text("race.start").frame(width: ResultRow.numberWidth, alignment: .trailing)
            Text("race.points").frame(width: ResultRow.numberWidth, alignment: .trailing)
            Text("race.gap").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .padding(.horizontal, Metrics.rowInsetH)
    }
}

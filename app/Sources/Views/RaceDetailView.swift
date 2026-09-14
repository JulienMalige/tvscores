import SwiftUI

/// The full classification of one race: podium, then every driver with the
/// grid slot they started from, the points they took and their gap to the win.
struct RaceDetailView: View {
    let eventId: String
    /// What the row showed when it was tapped, used until the store answers.
    let fallback: Event
    let store: ScoreboardStore

    /// Re-read from the store on every pass: the page outlives a refresh, so a
    /// race in progress keeps moving and portraits resolved later turn up.
    private var event: Event {
        guard let board = store.board else { return fallback }
        for day in Day.allCases {
            for group in board.groups(for: day) {
                if let hit = group.events.first(where: { $0.id == eventId }) { return hit }
            }
        }
        return fallback
    }

    private var rows: [RaceResult] { event.results ?? [] }
    private var finishers: [RaceResult] { rows.filter(\.finished) }
    private var retired: [RaceResult] { rows.filter { !$0.finished } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 36) {
                header
                if finishers.isEmpty {
                    Text("home.empty")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 80)
                } else {
                    podium
                    table
                }
            }
            .padding(.horizontal, 80)
            .padding(.top, 60)
            .padding(.bottom, 80)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(event.name ?? "")
                .font(.system(size: 48, weight: .bold))
            HStack(spacing: 16) {
                Text([event.circuit, event.country].compactMap { $0 }.joined(separator: " · "))
                    .font(.title3)
                    .foregroundStyle(.secondary)
                Spacer()
                StatusView(status: event.status, start: event.start)
            }
        }
    }

    private var podium: some View {
        HStack(spacing: 24) {
            ForEach(finishers.prefix(3)) { r in
                VStack(spacing: 10) {
                    Avatar(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                           monogram: r.code ?? Avatar.monogram(for: r.driver), size: 110)
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

    private var table: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("race.result").font(.title3.weight(.semibold))
            columnTitles
            ForEach(finishers) { RaceResultRow(result: $0) }
            if !retired.isEmpty {
                Text("race.retired")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.top, 18)
                ForEach(retired) { RaceResultRow(result: $0) }
            }
        }
    }

    private var columnTitles: some View {
        HStack(spacing: 0) {
            Text("race.driver").frame(width: 640, alignment: .leading)
            Text("race.start").frame(width: 160, alignment: .trailing)
            Text("race.points").frame(width: 160, alignment: .trailing)
            Text("race.gap").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.callout)
        .foregroundStyle(.secondary)
        .padding(.horizontal, 28)
    }
}

private struct RaceResultRow: View {
    let result: RaceResult
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 18) {
                Text(result.pos.map { String($0) } ?? "–")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .frame(width: 60, alignment: .trailing)
                Avatar(photo: result.photo, flag: result.flag, color: Color(hex: result.teamColor),
                       monogram: result.code ?? Avatar.monogram(for: result.driver), size: 64)
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
            .frame(width: 640, alignment: .leading)
            Text(result.grid.map { String($0) } ?? "")
                .frame(width: 160, alignment: .trailing)
            // A blank reads better than a column of zeros for the non-scorers.
            Text((result.points ?? 0) > 0 ? String(result.points ?? 0) : "")
                .frame(width: 160, alignment: .trailing)
            Text(result.gap ?? "")
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(.title3)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.vertical, 14)
        .padding(.horizontal, 28)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(isFocused ? Color.white.opacity(0.14) : Color.white.opacity(0.04))
        )
        // tvOS scrolls by moving focus. Without this the page would be stuck
        // at the top and most of the field unreachable.
        .focusable()
        .scaleEffect(isFocused ? 1.01 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }
}

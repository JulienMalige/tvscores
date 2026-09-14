import SwiftUI

/// One competition: the same three day tabs filtered to it, and its standings below.
struct LeagueView: View {
    let ref: LeagueRef
    let store: ScoreboardStore
    @State var day: Day
    @State private var standings: Standings?
    @State private var standingsLoaded = false
    @State private var table = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                HStack(spacing: 18) {
                    LeagueMark(sport: ref.sport, logo: ref.logo)
                    Text(ref.name)
                        .font(.system(size: 48, weight: .bold))
                    Spacer()
                    Text(Date.now, format: .dateTime.weekday(.wide).day().month(.wide))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                DayTabs(selected: $day)
                games
                standingsSection
            }
            .padding(.horizontal, 80)
            .padding(.top, 60)
            .padding(.bottom, 80)
        }
        .scrollClipDisabled()
        .task {
            standings = await store.standings(for: ref)
            standingsLoaded = true
        }
    }

    @ViewBuilder
    private var games: some View {
        let groups = (store.board?.groups(for: day) ?? []).filter { ref.matches($0) }
        if groups.isEmpty {
            Text("home.empty")
                .font(.title3)
                .foregroundStyle(.secondary)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        } else {
            ForEach(groups) { group in
                LeagueSection(group: group, showHeader: false)
            }
        }
    }

    @ViewBuilder
    private var standingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("standings.title")
                .font(.title2.weight(.bold))
                .padding(.top, 12)
            if let standings, !standings.tables.isEmpty {
                if standings.tables.count > 1 {
                    HStack(spacing: 20) {
                        ForEach(Array(standings.tables.enumerated()), id: \.offset) { i, t in
                            Button(tableTitle(t.id)) { table = i }
                                .buttonStyle(.bordered)
                                .fontWeight(table == i ? .bold : .regular)
                        }
                        Spacer()
                    }
                }
                StandingsTableView(table: standings.tables[min(table, standings.tables.count - 1)])
            } else if standingsLoaded {
                Text("standings.unavailable")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
            }
        }
    }

    private func tableTitle(_ id: String) -> LocalizedStringKey {
        switch id {
        case "drivers": "standings.drivers"
        case "constructors": "standings.constructors"
        case "teams": "standings.teams"
        case "rankings": "standings.rankings"
        default: LocalizedStringKey(id)
        }
    }
}

struct StandingsTableView: View {
    let table: StandingsTable

    var body: some View {
        VStack(spacing: 2) {
            ForEach(table.rows) { row in
                Button {
                } label: {
                    StandingsRowView(row: row, unit: table.id == "rankings" ? "standings.unit.points" : "standings.unit.pts")
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct StandingsRowView: View {
    let row: StandingsRow
    let unit: LocalizedStringKey
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 20) {
            Text("\(row.pos)")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .monospacedDigit()
                .frame(width: 64, alignment: .trailing)
            RoundedRectangle(cornerRadius: 3)
                .fill(Color(hex: row.color) ?? .clear)
                .frame(width: 6, height: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text([row.flag, row.name].compactMap { $0 }.joined(separator: " "))
                    .font(.title3.weight(.semibold))
                if let sub = row.sub {
                    Text(sub).font(.callout).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let v = row.value {
                Text(v, format: .number.grouping(.automatic))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 24)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(isFocused ? 0.14 : 0.04)))
        .scaleEffect(isFocused ? 1.01 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }
}

extension Color {
    /// "#27f4d2" -> Color; nil for anything else.
    init?(hex: String?) {
        guard let hex, hex.hasPrefix("#"), hex.count == 7, let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
        self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
    }
}

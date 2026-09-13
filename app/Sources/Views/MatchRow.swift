import SwiftUI

/// Apple Sports row shape: badge · name | score | status | score | badge · name.
struct MatchRow: View {
    let event: Event

    var body: some View {
        Button {
            // Match detail comes later.
        } label: {
            RowContent(event: event)
        }
        .buttonStyle(.plain)
    }
}

private struct RowContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 0) {
            side(event.home, leading: true)
                .frame(width: 360, alignment: .leading)
            scoreText(event.score?.home, winner: winner == .home)
                .frame(width: 140, alignment: .trailing)
            StatusView(status: event.status, start: event.start)
                .frame(maxWidth: .infinity)
            scoreText(event.score?.away, winner: winner == .away)
                .frame(width: 140, alignment: .leading)
            side(event.away, leading: false)
                .frame(width: 360, alignment: .trailing)
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 24)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(isFocused ? Color.white.opacity(0.14) : Color.white.opacity(0.04))
        )
        .scaleEffect(isFocused ? 1.02 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }

    private enum Winner { case home, away, nobody }

    private var winner: Winner {
        guard event.status.state == .final, let h = event.score?.home, let a = event.score?.away else { return .nobody }
        return h > a ? .home : a > h ? .away : .nobody
    }

    @ViewBuilder
    private func side(_ team: TeamRef?, leading: Bool) -> some View {
        if let team {
            HStack(spacing: 16) {
                if !leading { Text(team.label).font(.title3).lineLimit(1).minimumScaleFactor(0.7) }
                TeamBadge(code: team.short, logo: team.logo)
                if leading { Text(team.label).font(.title3).lineLimit(1).minimumScaleFactor(0.7) }
            }
        }
    }

    private func scoreText(_ value: Int?, winner: Bool) -> some View {
        Text(value.map { String($0) } ?? "–")
            .font(.system(size: 54, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(loser(winner) ? .secondary : .primary)
    }

    private func loser(_ isWinner: Bool) -> Bool {
        self.winner != .nobody && !isWinner
    }
}

/// Team crest from the proxy when it has one, otherwise a coloured monogram.
struct TeamBadge: View {
    let code: String
    var logo: URL? = nil

    var body: some View {
        Group {
            if let logo {
                AsyncImage(url: logo) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFit().padding(6)
                    } else {
                        monogram
                    }
                }
            } else {
                monogram
            }
        }
        .frame(width: 72, height: 72)
    }

    private var monogram: some View {
        Text(code)
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: 72, height: 72)
            .background(Circle().fill(Color(hue: hue, saturation: 0.55, brightness: 0.55)))
    }

    /// Stable colour per code until real team colours exist.
    private var hue: Double {
        let h = code.unicodeScalars.reduce(7) { ($0 &* 31 &+ Int($1.value)) & 0xffff }
        return Double(h % 360) / 360
    }
}

struct StatusView: View {
    let status: Status
    let start: Date

    var body: some View {
        VStack(spacing: 4) {
            switch status.state {
            case .scheduled:
                if !Calendar.current.isDateInToday(start) {
                    Text(start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Text(start, format: .dateTime.hour().minute())
                    .font(.title2.weight(.semibold))
                if let d = status.detail { detailText(d) }
            case .live:
                Text(status.clock ?? localizedDetail(status.detail) ?? String(localized: "status.live"))
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.green)
                if status.clock != nil, let d = status.detail { detailText(d) }
            case .final:
                Text("status.final")
                    .font(.title2.weight(.semibold))
                if let d = status.detail { detailText(d) }
            case .other:
                Text(localizedDetail(status.detail) ?? "–")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func detailText(_ d: String) -> some View {
        Text(localizedDetail(d) ?? d)
            .font(.callout)
            .foregroundStyle(.secondary)
    }

    /// The proxy sends English detail strings; map the known ones to the catalog.
    private func localizedDetail(_ d: String?) -> String? {
        guard let d else { return nil }
        let keys: [String: String] = [
            "Half-time": "status.halftime", "Extra time": "status.extratime", "Penalties": "status.penalties",
            "After extra time": "status.aet", "After penalties": "status.apen", "After overtime": "status.aot",
            "Postponed": "status.postponed", "Cancelled": "status.cancelled", "Suspended": "status.suspended",
            "Interrupted": "status.interrupted", "Abandoned": "status.abandoned", "Time TBD": "status.tbd", "Race": "status.race",
        ]
        guard let key = keys[d] else { return d }
        return String(localized: String.LocalizationValue(key))
    }
}

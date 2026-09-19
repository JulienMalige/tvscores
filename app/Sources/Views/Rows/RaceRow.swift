import SwiftUI

/// A race weekend: the country's flag, the event, its status, and the podium
/// once the race is classified.
struct RaceRow: View {
    let event: Event

    var body: some View {
        NavigationLink(value: event) {
            RaceRowContent(event: event)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("race.\(event.id)")
    }
}

private struct RaceRowContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: Metrics.headingGap) {
            HStack(spacing: 20) {
                FlagMark(flag: event.flag)
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.name ?? "")
                        .font(.title3.weight(.semibold))
                    Text([event.circuit, event.country].compactMap { $0 }.joined(separator: " · "))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusLabel(status: event.status, start: event.start)
            }
            let podium = (event.results ?? []).filter(\.finished).prefix(3)
            if !podium.isEmpty {
                HStack(spacing: 24) {
                    ForEach(podium) { r in
                        HStack(spacing: 14) {
                            Text("\(r.pos ?? 0)")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                            PersonMark(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor),
                                       monogram: r.code ?? PersonMark.monogram(for: r.driver), size: Metrics.mark)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.driver).font(.callout.weight(.semibold))
                                Text(r.gap ?? r.team ?? "").font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
        }
        .rowSurface(focused: isFocused)
    }
}

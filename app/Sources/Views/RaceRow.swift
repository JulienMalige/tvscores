import SwiftUI

/// Formula 1 (and later MotoGP): event name, status, podium once the race is classified.
struct RaceRow: View {
    let event: Event

    var body: some View {
        Button {
        } label: {
            RaceContent(event: event)
        }
        .buttonStyle(.plain)
    }
}

private struct RaceContent: View {
    let event: Event
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.name ?? "")
                        .font(.title3.weight(.semibold))
                    Text([event.circuit, event.country].compactMap { $0 }.joined(separator: " · "))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusView(status: event.status, start: event.start)
            }
            if let results = event.results, !results.isEmpty {
                HStack(spacing: 24) {
                    ForEach(results) { r in
                        HStack(spacing: 14) {
                            Text("\(r.pos)")
                                .font(.system(size: 34, weight: .bold, design: .rounded))
                            Avatar(photo: r.photo, flag: r.flag, color: Color(hex: r.teamColor), monogram: r.code ?? Avatar.monogram(for: r.driver), size: 64)
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
        .padding(.vertical, 22)
        .padding(.horizontal, 28)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(isFocused ? Color.white.opacity(0.14) : Color.white.opacity(0.04))
        )
        .scaleEffect(isFocused ? 1.02 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }
}

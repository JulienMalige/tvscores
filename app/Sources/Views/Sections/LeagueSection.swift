import SwiftUI

struct LeagueSection: View {
    let group: LeagueGroup
    var linkToLeague = false
    var showHeader = true

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            if linkToLeague {
                // The focusable area spans the row width, not the words:
                // tvOS moves focus in straight lines, and a heading that only
                // covers the left edge is stepped over from the full-width
                // row beneath. The highlight itself stays on the words.
                NavigationLink(value: LeagueRef(group: group)) {
                    LeagueHeader(group: group, chevron: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("league.\(group.sport).\(group.league.id.raw)")
            } else if showHeader {
                LeagueHeader(group: group, chevron: false)
            }
            VStack(spacing: Metrics.rowGap) {
                ForEach(group.events) { event in
                    switch event.kind {
                    case .match: MatchRow(event: event)
                    case .race: RaceRow(event: event)
                    }
                }
            }
        }
    }
}

struct LeagueHeader: View {
    let group: LeagueGroup
    let chevron: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 14) {
            LeagueMark(sport: group.sport, logo: group.league.logo)
            Text(group.league.name)
                .font(.title3.weight(.semibold))
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(isFocused ? 0.14 : 0)))
        .scaleEffect(isFocused ? 1.03 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
    }
}

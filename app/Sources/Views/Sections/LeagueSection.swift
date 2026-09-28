import SwiftUI

struct LeagueSection: View {
    let group: LeagueGroup
    /// The day the section is listed under, for a race weekend's rows.
    let day: Day
    var now: Date = .now
    /// On the front page, the heading opens the competition — in its own
    /// place in the menu, not as a page pushed over Home, so the menu says
    /// where you are whichever way you came.
    var openLeague: ((LeagueRef) -> Void)? = nil
    var showHeader = true

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            if let openLeague {
                // The focusable area spans the row width, not the words:
                // tvOS moves focus in straight lines, and a heading that only
                // covers the left edge is stepped over from the full-width
                // row beneath. The highlight itself stays on the words.
                Button {
                    openLeague(LeagueRef(group: group))
                } label: {
                    LeagueHeader(group: group, chevron: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("league.\(group.sport).\(group.league.id.raw)")
            } else if showHeader {
                LeagueHeader(group: group, chevron: false)
            }
            // Tennis names its tournaments, each under a heading with its
            // country's flag, as a race weekend is shown; other sports have
            // one run and no heading.
            ForEach(Array(group.events.byCompetition().enumerated()), id: \.offset) { _, run in
                if let competition = run.competition { TournamentHeader(competition: competition) }
                VStack(spacing: Metrics.rowGap) {
                    ForEach(run.events) { event in
                        switch event.kind {
                        case .match: MatchRow(event: event)
                        case .race: RaceRow(event: event, day: day, now: now)
                        }
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

/// A tournament's heading inside a tour's list: its flag, its name, and its
/// tier and surface — "Beijing", "WTA 1000 · Hard".
struct TournamentHeader: View {
    let competition: Competition

    var body: some View {
        HStack(spacing: 14) {
            FlagMark(flag: competition.flag, size: Metrics.leagueMark)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: competition.name)
                    .font(.callout.weight(.semibold))
                if let line = subtitle {
                    line
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.top, 6)
        .padding(.horizontal, 16)
        .accessibilityIdentifier("tournament.\(competition.name)")
    }

    private var subtitle: Text? {
        let surface = competition.surface.map { Text(LocalizedStringKey("surface." + $0)) }
        switch (competition.tier, surface) {
        case let (tier?, surface?): return Text(verbatim: tier + " · ") + surface
        case let (tier?, nil): return Text(verbatim: tier)
        case let (nil, surface?): return surface
        case (nil, nil): return nil
        }
    }
}

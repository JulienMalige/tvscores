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
    /// On the competition's own page: each tournament or race weekend under
    /// a centred heading, as Apple Sports' league page. The front page keeps
    /// it compact, a grey line over each row naming where it is.
    var onPage = false

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
            let runs = group.events.byCompetition()
            ForEach(Array(runs.enumerated()), id: \.offset) { _, run in
                if let competition = run.competition {
                    if onPage { TournamentHeader(competition: competition) }
                } else if runs.count > 1, onPage {
                    // Matches whose tournament the feed did not name, kept
                    // apart so they do not read as the heading's above.
                    Text("tournament.other")
                        .font(.callout.weight(.semibold))
                        .padding(.top, 6)
                        .padding(.horizontal, 16)
                }
                VStack(spacing: 0) {
                    ForEach(Array(run.events.enumerated()), id: \.element.id) { i, event in
                        if i > 0 { RowRule() }
                        switch event.kind {
                        case .match: MatchRow(event: event)
                        case .race: RaceRow(event: event, day: day, now: now, onPage: onPage)
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

/// A tournament's heading on its tour's page, centred over its matches as
/// Apple Sports heads the China Open: the flag large (the feed has no
/// tournament logos), the name, then tier, surface and town in grey —
/// "Beijing", "WTA 1000 · Hard · Beijing, CN".
struct TournamentHeader: View {
    let competition: Competition

    var body: some View {
        VStack(spacing: 8) {
            FlagMark(flag: competition.flag, size: Metrics.markHero * 0.6)
            Text(verbatim: competition.name)
                .font(.headline)
            if let line = subtitle {
                line
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Metrics.headingGap)
        .accessibilityIdentifier("tournament.\(competition.name)")
    }

    private var subtitle: Text? {
        let surface = competition.surface.map { raw -> Text in
            let known = ["hard", "clay", "grass"]
            return known.contains(raw.lowercased()) ? Text(LocalizedStringKey("surface." + raw.lowercased())) : Text(verbatim: raw.capitalized)
        }
        var parts: [Text] = []
        if let tier = competition.tier { parts.append(Text(verbatim: tier)) }
        if let surface { parts.append(surface) }
        if let city = competition.city, city != competition.name { parts.append(Text(verbatim: city)) }
        guard let first = parts.first else { return nil }
        return parts.dropFirst().reduce(first) { $0 + Text(verbatim: " · ") + $1 }
    }
}

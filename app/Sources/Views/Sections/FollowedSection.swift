import SwiftUI

/// The followed sides' games of one day, in kickoff order, each under the
/// grey name of its competition: Home's first section, under "★ My Teams ›",
/// and the whole of the My Teams page (Julien, 2026-11-15, from Apple
/// Sports' screens).
struct FollowedSection: View {
    let games: [(group: LeagueGroup, event: Event)]
    let day: Day
    var now: Date = .now
    /// On Home, the heading opens the My Teams page; the page itself has none.
    var openMyTeams: (() -> Void)? = nil
    @FocusState private var focusedRow: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Metrics.headingGap) {
            if let openMyTeams {
                // Full width, as a competition's heading: tvOS moves focus in
                // straight lines, and words alone are stepped over.
                Button(action: openMyTeams) {
                    MyTeamsHeader()
                        .padding(.leading, Metrics.leagueHeadingInset)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(QuietButtonStyle())
                .accessibilityIdentifier("home.myTeams")
            }
            VStack(spacing: 0) {
                ForEach(Array(games.enumerated()), id: \.element.event.id) { i, item in
                    if i > 0 {
                        RowRule()
                            .opacity(focusedRow == item.event.id || focusedRow == games[i - 1].event.id ? 0 : 1)
                    }
                    VStack(spacing: 0) {
                        Text(verbatim: item.group.league.name)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .padding(.top, Metrics.matchRowPad / 2)
                        Group {
                            switch item.event.kind {
                            case .match: MatchRow(event: item.event)
                            case .race: RaceRow(event: item.event, day: day, now: now, onPage: false)
                            }
                        }
                        .focused($focusedRow, equals: item.event.id)
                    }
                    .zIndex(focusedRow == item.event.id ? 1 : 0)
                }
            }
        }
    }
}

/// "★ My Teams ›", lit on glass as a competition's heading is.
private struct MyTeamsHeader: View {
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: .tv(14)) {
            Image(systemName: "star.fill")
                .font(.caption.weight(.semibold))
            Text("myTeams.title")
                .font(.caption.weight(.semibold))
            Image(systemName: "chevron.right")
                .font(.callout.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .headingGlass(isFocused)
    }
}

/// My Teams with nobody followed yet, as Apple Sports words it: what it is
/// for, and the button that starts choosing.
struct FollowPrompt: View {
    let choose: () -> Void

    var body: some View {
        VStack(spacing: .tv(20)) {
            Text("myTeams.emptyTitle")
                .font(.headline)
            Text("myTeams.emptyLine")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(action: choose) {
                Text("myTeams.choose")
                    .font(.callout.weight(.semibold))
                    .padding(.horizontal, .tv(16))
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("myTeams.choose")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Metrics.cardInsetV * 1.5)
    }
}

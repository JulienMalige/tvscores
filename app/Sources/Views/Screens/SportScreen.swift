import SwiftUI

/// One family of sport — Football, Motorsport, US sports, Tennis — with a
/// switch between its competitions above the day switch.
///
/// The menu carries the four families rather than all fifteen competitions
/// because tvOS's own sidebar loses focus past seven tabs: the menu opened
/// and shut in one movement from the lower rows (Apple's known issue,
/// forum thread 769884, still there on tvOS 26.6). Julien chose this over a
/// sidebar of our own on 2026-09-28.
///
/// All, the first pill, lists every competition of the family for the day,
/// each under its heading; a heading picks that competition. A competition
/// picked shows its own day, games and table.
struct SportScreen: View {
    let section: SportSection
    let leagues: [LeagueSummary]
    let store: ScoreboardStore
    let choices: SportChoices

    private var picked: LeagueSummary? {
        guard let key = choices.competition(section.id) else { return nil }
        return leagues.first { SportChoices.key(sport: $0.sport, id: $0.id.raw) == key }
    }

    private var day: Binding<Day> {
        Binding(get: { choices.day(section.id) }, set: { choices.setDay($0, for: section.id) })
    }

    private var competition: Binding<String?> {
        Binding(get: { picked.map { SportChoices.key(sport: $0.sport, id: $0.id.raw) } },
                set: { choices.setCompetition($0, for: section.id) })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                header
                Segments(selection: competition, options: options, scrolls: true)
                    .accessibilityIdentifier("competition.switch")
                if let picked {
                    // A fresh section per competition, so its table loads
                    // for it rather than keeping the last one's.
                    CompetitionSection(ref: LeagueRef(picked), store: store, day: day)
                        .id(picked.id)
                } else {
                    DayTabs(selected: day)
                    everyGame
                }
            }
            .pageMargins()
        }
        .scrollClipDisabled()
    }

    private var header: some View {
        HStack(spacing: Metrics.headingGap) {
            Text(section.title)
                .font(.system(size: 48, weight: .bold))
            Spacer()
            ClockLabel()
        }
    }

    private var options: [Segments<String?>.Option] {
        [.init(value: nil, title: Text("sidebar.all"), identifier: "competition.all")]
            + leagues.map { league in
                .init(value: SportChoices.key(sport: league.sport, id: league.id.raw),
                      title: Text(verbatim: league.menu),
                      icon: league.icon ?? league.logo,
                      identifier: "competition.\(league.sport).\(league.id.raw)")
            }
    }

    @ViewBuilder
    private var everyGame: some View {
        let groups = (store.board?.groups(for: day.wrappedValue) ?? []).filter { section.sports.contains($0.sport) }
        if groups.isEmpty {
            EmptyDay(compact: true)
        } else {
            LazyVStack(alignment: .leading, spacing: Metrics.sectionGap) {
                ForEach(groups) { group in
                    LeagueSection(group: group, day: day.wrappedValue, now: store.board?.generatedAt ?? .now) { ref in
                        choices.setCompetition(SportChoices.key(sport: ref.sport, id: ref.leagueId), for: section.id)
                    }
                }
            }
        }
    }
}

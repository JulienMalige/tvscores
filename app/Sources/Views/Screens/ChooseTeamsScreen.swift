import SwiftUI

/// Choosing whom to follow (Julien, 2026-11-15, from Apple Sports): the
/// competitions by family, each opening its teams — or its drivers, riders
/// and players — with a star on each; and a search over all of them, each
/// found side under the grey name of its competition. Competitions
/// themselves are shown or hidden in Settings, not here (Julien,
/// 2026-11-15).
struct ChooseTeamsScreen: View {
    let store: ScoreboardStore
    /// Every competition the proxy serves, shown or not.
    let leagues: [LeagueSummary]
    @State private var teams: [String: [TeamEntry]]?
    @State private var failed = false
    @State private var query = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if let teams {
                    if query.trimmingCharacters(in: .whitespaces).isEmpty {
                        competitions(teams)
                    } else {
                        found(teams)
                    }
                } else if failed {
                    EmptyDay(title: Text("myTeams.unreachable"), line: nil)
                } else {
                    ProgressView()
                }
            }
            .navigationTitle(Text("myTeams.choose"))
            .navigationDestination(for: LeagueSummary.self) { league in
                TeamList(entries: teams?[MenuItem.key(league)] ?? [])
                    .navigationTitle(Text(verbatim: league.menu))
            }
            .searchable(text: $query, prompt: Text("myTeams.search"))
            #if os(iOS)
            .toolbar {
                Button { dismiss() } label: { Text("settings.done").bold() }
                    .accessibilityIdentifier("myTeams.done")
            }
            #endif
        }
        .tint(.primary)
        .accessibilityIdentifier("page.chooseTeams")
        .usagePage(.chooseTeams)
        .task {
            teams = await store.teams()
            failed = teams == nil
        }
    }

    /// The competitions by family, each with how many of its sides are followed.
    private func competitions(_ teams: [String: [TeamEntry]]) -> some View {
        List {
            ForEach(SportSection.grouped(leagues, all: true), id: \.section.id) { entry in
                let listed = entry.leagues.filter { !(teams[MenuItem.key($0)] ?? []).isEmpty }
                if !listed.isEmpty {
                    Section(entry.section.title) {
                        ForEach(listed) { league in
                            NavigationLink(value: league) {
                                CompetitionLine(league: league, followed: followedCount(teams[MenuItem.key(league)] ?? []))
                            }
                            .accessibilityIdentifier("chooseTeams.\(league.sport).\(league.id.raw)")
                        }
                    }
                }
            }
        }
    }

    /// What the search finds: sides first, each once per competition as
    /// Apple Sports lists them, then competitions.
    private func found(_ teams: [String: [TeamEntry]]) -> some View {
        let words = Self.fold(query)
        let named = leagues.filter { Self.fold($0.name).contains(words) || Self.fold($0.menu).contains(words) }
            .filter { !(teams[MenuItem.key($0)] ?? []).isEmpty }
        let sides = leagues.flatMap { league in
            (teams[MenuItem.key(league)] ?? []).filter { Self.fold($0.name).contains(words) }.map { (league: league, entry: $0) }
        }
        return List {
            if sides.isEmpty, named.isEmpty {
                Text("myTeams.noMatch").foregroundStyle(.secondary)
            }
            if !sides.isEmpty {
                Section("myTeams.teams") {
                    ForEach(sides.prefix(60), id: \.entry.key) { hit in
                        TeamLine(entry: hit.entry, caption: hit.league.name)
                    }
                }
            }
            if !named.isEmpty {
                Section("menu.title") {
                    ForEach(named) { league in
                        NavigationLink(value: league) { CompetitionLine(league: league, followed: 0) }
                    }
                }
            }
        }
    }

    private func followedCount(_ entries: [TeamEntry]) -> Int {
        entries.filter { Favourites.shared.isFollowed($0.key) }.count
    }

    /// For the search: "Atlético" is found by "atletico".
    static func fold(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).lowercased().trimmingCharacters(in: .whitespaces)
    }
}

/// A competition in the picker: its mark, its name, and a star with how
/// many of its sides are followed.
private struct CompetitionLine: View {
    let league: LeagueSummary
    let followed: Int

    var body: some View {
        HStack(spacing: .tv(18)) {
            MenuIcon.league(league).view(size: Metrics.menuIcon)
            Text(verbatim: league.menu)
            Spacer()
            if followed > 0 {
                Label { Text(verbatim: "\(followed)") } icon: { Image(systemName: "star.fill") }
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// A competition's sides, in name order, each starred or not.
private struct TeamList: View {
    let entries: [TeamEntry]

    var body: some View {
        List(entries) { entry in
            TeamLine(entry: entry, caption: nil)
        }
    }
}

/// One side, starred with a press: the star in its circle, the crest or the
/// portrait, the name, and in grey where it plays when the search found it.
struct TeamLine: View {
    let entry: TeamEntry
    let caption: String?
    @State private var favourites = Favourites.shared

    var body: some View {
        let on = favourites.isFollowed(entry.key)
        Button {
            favourites.toggle(entry.key, name: entry.name)
        } label: {
            HStack(spacing: .tv(18)) {
                Image(systemName: on ? "star.fill" : "star")
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(on ? Color.black : Color.primary)
                    .frame(width: Metrics.menuIcon, height: Metrics.menuIcon)
                    .background(Circle().fill(on ? Color.white : Color.white.opacity(0.12)))
                if entry.logo == nil, entry.photo != nil || entry.flag != nil {
                    PersonMark(photo: entry.photo, flag: entry.flag, monogram: entry.monogram, size: Metrics.menuIcon)
                } else {
                    TeamMark(code: entry.monogram, logo: entry.logo, size: Metrics.menuIcon)
                }
                VStack(alignment: .leading, spacing: .tv(2)) {
                    Text(verbatim: entry.name)
                    if let caption {
                        Text(verbatim: caption)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
        }
        .accessibilityIdentifier("team.\(entry.key)")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

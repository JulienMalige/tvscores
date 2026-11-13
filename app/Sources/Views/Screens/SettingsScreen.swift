import SwiftUI

/// Settings, from the gear at the top of the menu, laid out as tvOS's own
/// settings pages are (Julien, build 36, from the Apple TV's Settings): the
/// page's title on top; on the left a large picture and a sentence saying
/// what this page is for; on the right the list. Choosing a row slides the
/// next list in on the right while the left explains it, and Back returns.
///
/// - the top: Competitions, Where to watch, Language (each with its value),
///   Sources, Version, and in a tester's build Debug, with Open apps;
/// - Competitions: every competition by family, ticked to show it, and
///   moved up or down by holding select on it (builds 36 and 47);
/// - Where to watch: a checklist of countries — none, one or several;
/// - Language: the Apple TV's, or one of the app's four.
struct SettingsScreen: View {
    /// Every competition the proxy serves, shown or not.
    let leagues: [LeagueSummary]
    /// The apps How to Watch points at, for the Apps page and Debug's Open apps.
    var apps: [String: WatchApp] = [:]

    @State private var page = SettingsPage.top
    @State private var choice = ChannelChoice.shared
    @State private var leagueChoice = LeagueChoice.shared
    @State private var appChoice = AppChoice.shared
    @State private var language = LanguageChoice.current
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(short) (\(build))"
    }

    var body: some View {
        VStack(spacing: Metrics.settingsTitleGap) {
            Text(page.title)
                .font(.title3.weight(.bold))
            HStack(alignment: .top, spacing: Metrics.settingsGap) {
                explanation
                    .frame(maxWidth: .infinity)
                Group {
                    switch page {
                    case .top: topList
                    case .competitions: competitionList
                    case .countries: countryList
                    case .language: languageList
                    case .apps: AppsChoiceSection(apps: apps)
                    case .openApps: OpenAppsSection(apps: apps)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .top)
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity),
                                        removal: .opacity))
                .id(page)
            }
        }
        .animation(.easeOut(duration: 0.25), value: page)
        .padding(.horizontal, Metrics.settingsMargin)
        .padding(.vertical, Metrics.screenBottom)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(PageTint(color: .homeTint))
        .ignoresSafeArea()
        // Back climbs one level, then puts Settings away.
        .onExitCommand {
            if page == .top { dismiss() } else { page = .top }
        }
        .accessibilityIdentifier("page.settings")
        .task {
            // `-TVScoresSettings countries` opens on that list (CI screenshots).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-TVScoresSettings"), i + 1 < args.count {
                page = ["countries": .countries, "competitions": .competitions, "language": .language, "apps": .apps, "openApps": .openApps][args[i + 1]] ?? .top
                if page == .openApps, !Edition.current.hasTesterTools { page = .top }
            }
        }
    }

    /// The left: what this page is for.
    private var explanation: some View {
        VStack(spacing: 40) {
            if page == .top {
                CourtMark()
                    .frame(width: Metrics.settingsMark, height: Metrics.settingsMark * 0.6)
            } else if let symbol = page.symbol {
                Image(systemName: symbol)
                    .font(.system(size: Metrics.settingsMark * 0.45, weight: .light))
                    .frame(height: Metrics.settingsMark * 0.6)
            }
            Text(page.blurb)
                .font(.callout.weight(.medium))
                .multilineTextAlignment(.center)
                .frame(maxWidth: Metrics.settingsMark * 1.2)
        }
        .padding(.top, Metrics.settingsTitleGap)
    }

    private var chosenCountries: String {
        let names = choice.countries.map { LanguageChoice.locale.localizedString(forRegionCode: $0) ?? $0 }
        return names.isEmpty ? String(localized: "settings.none", bundle: LanguageChoice.bundle) : names.joined(separator: ", ")
    }

    private var topList: some View {
        List {
            Button { page = .competitions } label: {
                LabeledContent("settings.competitions") { Text(verbatim: shownCount) }
            }
            .accessibilityIdentifier("settings.competitions")
            Button { page = .countries } label: {
                LabeledContent("settings.watch") { Text(verbatim: chosenCountries) }
            }
            .accessibilityIdentifier("settings.watch")
            Button { page = .apps } label: {
                LabeledContent("settings.apps") { Text(verbatim: appsShown) }
            }
            .accessibilityIdentifier("settings.apps")
            Button { page = .language } label: {
                LabeledContent("settings.language") { Text(verbatim: language.map(LanguageChoice.name) ?? String(localized: "settings.languageSystem", bundle: LanguageChoice.bundle)) }
            }
            .accessibilityIdentifier("settings.language")
            Section("settings.sources") {
                fact("settings.scores", "TheSportsDB, Live Tennis API, Orange Cat, Jolpica")
                fact("settings.listings", "TheSportsDB, XML TV Fr, epgshare01")
                // Their licence asks for the credit; the tables themselves name no source (2026-11-09).
                fact("settings.rugbyTables", "Wikipedia, CC BY-SA 4.0")
            }
            Section("settings.about") {
                fact("settings.version", version)
            }
            // A tester's tools: the store build has no Debug section (`Edition`).
            if Edition.current.hasTesterTools {
                Section {
                    Button { page = .openApps } label: {
                        LabeledContent("settings.openApps") { Text(verbatim: "\(apps.count)") }
                    }
                    .accessibilityIdentifier("settings.openApps")
                } header: {
                    Text("settings.debug")
                        .accessibilityIdentifier("settings.debug")
                }
            }
        }
    }

    /// One row per country, ticked when its channels are shown.
    private var countryList: some View {
        List {
            ForEach(ChannelChoice.all, id: \.self) { country in
                Button { choice.toggle(country) } label: {
                    HStack(spacing: 18) {
                        FlagMark(flag: ChannelChoice.flag(country), size: Metrics.settingsFlag)
                        Text(verbatim: LanguageChoice.locale.localizedString(forRegionCode: country) ?? country)
                        Spacer()
                        if choice.isOn(country) { Image(systemName: "checkmark") }
                    }
                }
                .accessibilityIdentifier("settings.country.\(country)")
                .accessibilityAddTraits(choice.isOn(country) ? .isSelected : [])
            }
        }
    }

    /// "34 of 49": the apps How to Watch offers.
    private var appsShown: String {
        let shown = apps.keys.filter { appChoice.isShown($0) }.count
        return String(localized: "settings.shownCount \(shown) \(apps.count)", bundle: LanguageChoice.bundle)
    }

    private var shownCount: String {
        let shown = leagues.filter { leagueChoice.isShown(Sidebar.key($0)) }.count
        return String(localized: "settings.shownCount \(shown) \(leagues.count)", bundle: LanguageChoice.bundle)
    }

    /// Every competition by family: select its row to show or hide it; hold
    /// select on it to move it up or down, from the menu tvOS opens there.
    private var competitionList: some View {
        List {
            ForEach(SportSection.grouped(leagues, all: true), id: \.section.id) { entry in
                let siblings = entry.leagues.map(Sidebar.key)
                Section(entry.section.title) {
                    ForEach(entry.leagues) { league in
                        competitionRow(league, siblings: siblings)
                    }
                }
            }
        }
    }

    /// One button: a list row is one place for the focus, so a handle beside
    /// the tick was pressed with it, and a press both hid a competition and
    /// lifted it (Julien, build 47). Moving is the row's held press instead.
    private func competitionRow(_ league: LeagueSummary, siblings: [String]) -> some View {
        let key = Sidebar.key(league)
        let shown = leagueChoice.isShown(key)
        return Button { leagueChoice.toggle(key) } label: {
            HStack(spacing: 18) {
                MenuIcon.league(league).view(size: Metrics.menuIcon)
                Text(verbatim: league.menu)
                Spacer()
                if shown { Image(systemName: "checkmark") }
            }
        }
        .accessibilityIdentifier("settings.league.\(key)")
        .accessibilityAddTraits(shown ? .isSelected : [])
        // The menu is tvOS's own, drawn outside the locale the views are
        // given: its words come from the chosen language's strings.
        .contextMenu {
            Button { leagueChoice.move(key, by: -1, among: siblings) } label: {
                Label(String(localized: "settings.moveUp", bundle: LanguageChoice.bundle), systemImage: "arrow.up")
            }
            .disabled(key == siblings.first)
            Button { leagueChoice.move(key, by: 1, among: siblings) } label: {
                Label(String(localized: "settings.moveDown", bundle: LanguageChoice.bundle), systemImage: "arrow.down")
            }
            .disabled(key == siblings.last)
        }
    }

    private var languageList: some View {
        List {
            ForEach([String?.none] + LanguageChoice.codes.map(Optional.some), id: \.self) { code in
                Button {
                    LanguageChoice.set(code)
                    language = code
                } label: {
                    HStack {
                        Text(verbatim: code.map(LanguageChoice.name) ?? String(localized: "settings.languageSystem", bundle: LanguageChoice.bundle))
                        Spacer()
                        if language == code { Image(systemName: "checkmark") }
                    }
                }
                .accessibilityIdentifier("settings.language.\(code ?? "system")")
            }
        }
    }

    /// A fact, not a choice: a row the remote can stand on, as tvOS's own.
    private func fact(_ label: LocalizedStringKey, _ value: String) -> some View {
        Button {} label: {
            LabeledContent(label) { Text(verbatim: value) }
        }
    }
}

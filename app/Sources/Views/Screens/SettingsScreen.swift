import SwiftUI

/// Settings, from the gear at the top of the menu, laid out as tvOS's own
/// settings pages are (Julien, build 36, from the Apple TV's Settings): the
/// page's title on top; on the left a large picture and a sentence saying
/// what this page is for; on the right the list. Choosing a row slides the
/// next list in on the right while the left explains it, and Back returns.
///
/// - the top: Competitions, Where to watch, Language (each with its value),
///   Sources, Version;
/// - Competitions: every competition by family, ticked to show it, with a
///   handle to move it up or down (build 36);
/// - Where to watch: a checklist of countries — none, one or several;
/// - Language: the Apple TV's, or one of the app's four.
struct SettingsScreen: View {
    /// Every competition the proxy serves, shown or not.
    let leagues: [LeagueSummary]

    private enum Page { case top, competitions, countries, language }

    @State private var page = Page.top
    @State private var choice = ChannelChoice.shared
    @State private var leagueChoice = LeagueChoice.shared
    @State private var language = LanguageChoice.current
    /// The competition being moved with the remote, if any.
    @State private var lifted: String?
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(short) (\(build))"
    }

    var body: some View {
        VStack(spacing: Metrics.settingsTitleGap) {
            Text(title)
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
        // Back sets a lifted competition down, climbs one level, then puts
        // Settings away.
        .onExitCommand {
            if lifted != nil { lifted = nil } else if page == .top { dismiss() } else { page = .top }
        }
        .accessibilityIdentifier("page.settings")
        .task {
            // `-TVScoresSettings countries` opens on that list (CI screenshots).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-TVScoresSettings"), i + 1 < args.count {
                page = ["countries": .countries, "competitions": .competitions, "language": .language][args[i + 1]] ?? .top
            }
        }
    }

    private var title: LocalizedStringKey {
        switch page {
        case .top: "settings.title"
        case .competitions: "settings.competitions"
        case .countries: "settings.watch"
        case .language: "settings.language"
        }
    }

    /// The left: what this page is for.
    private var explanation: some View {
        VStack(spacing: 40) {
            switch page {
            case .top:
                CourtMark()
                    .frame(width: Metrics.settingsMark, height: Metrics.settingsMark * 0.6)
            case .competitions: symbol("trophy")
            case .countries: symbol("tv")
            case .language: symbol("globe")
            }
            Text(blurb)
                .font(.callout.weight(.medium))
                .multilineTextAlignment(.center)
                .frame(maxWidth: Metrics.settingsMark * 1.2)
        }
        .padding(.top, Metrics.settingsTitleGap)
    }

    private func symbol(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: Metrics.settingsMark * 0.45, weight: .light))
            .frame(height: Metrics.settingsMark * 0.6)
    }

    private var blurb: LocalizedStringKey {
        switch page {
        case .top: "settings.blurb"
        case .competitions: lifted == nil ? "settings.competitionsNote" : "settings.movingNote"
        case .countries: "settings.countryNote"
        case .language: "settings.languageNote"
        }
    }

    private var chosenCountries: String {
        let names = choice.countries.map { Locale.current.localizedString(forRegionCode: $0) ?? $0 }
        return names.isEmpty ? String(localized: "settings.none") : names.joined(separator: ", ")
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
            Button { page = .language } label: {
                LabeledContent("settings.language") { Text(verbatim: language.map(LanguageChoice.name) ?? String(localized: "settings.languageSystem")) }
            }
            .accessibilityIdentifier("settings.language")
            Section("settings.sources") {
                fact("settings.scores", "TheSportsDB, Live Tennis API, Orange Cat, Jolpica")
                fact("settings.listings", "TheSportsDB, XML TV Fr, epgshare01")
            }
            Section("settings.about") {
                fact("settings.version", version)
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
                        Text(verbatim: Locale.current.localizedString(forRegionCode: country) ?? country)
                        Spacer()
                        if choice.isOn(country) { Image(systemName: "checkmark") }
                    }
                }
                .accessibilityIdentifier("settings.country.\(country)")
                .accessibilityAddTraits(choice.isOn(country) ? .isSelected : [])
            }
        }
    }

    private var shownCount: String {
        let shown = leagues.filter { leagueChoice.isShown(Sidebar.key($0)) }.count
        return String(localized: "settings.shownCount \(shown) \(leagues.count)")
    }

    /// Every competition by family: select its row to show or hide it;
    /// select its handle to lift it, move it with up and down, select
    /// again to set it down — as tvOS's own language list orders.
    private var competitionList: some View {
        List {
            ForEach(SportSection.grouped(leagues, all: true), id: \.section.id) { entry in
                Section(entry.section.title) {
                    ForEach(entry.leagues) { league in
                        competitionRow(league, siblings: entry.leagues.map(Sidebar.key))
                    }
                }
            }
        }
    }

    private func competitionRow(_ league: LeagueSummary, siblings: [String]) -> some View {
        let key = Sidebar.key(league)
        let shown = leagueChoice.isShown(key)
        return HStack(spacing: 20) {
            Button { leagueChoice.toggle(key) } label: {
                HStack(spacing: 18) {
                    MenuIcon.league(league).view(size: Metrics.menuIcon)
                    Text(verbatim: league.menu)
                    Spacer()
                    if shown { Image(systemName: "checkmark") }
                }
            }
            .accessibilityIdentifier("settings.league.\(key)")
            .accessibilityAddTraits(shown ? .isSelected : [])
            // While one is lifted only its handle takes focus, so up and
            // down move it rather than the remote's place in the list.
            .disabled(lifted != nil)
            Button { lifted = lifted == key ? nil : key } label: {
                Image(systemName: lifted == key ? "arrow.up.arrow.down" : "line.3.horizontal")
            }
            .accessibilityLabel(Text("settings.move"))
            .disabled(lifted != nil && lifted != key)
            .onMoveCommand { direction in
                guard lifted == key else { return }
                switch direction {
                case .up: leagueChoice.move(key, by: -1, among: siblings)
                case .down: leagueChoice.move(key, by: 1, among: siblings)
                default: break
                }
            }
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
                        Text(verbatim: code.map(LanguageChoice.name) ?? String(localized: "settings.languageSystem"))
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

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
///
/// On an iPhone or an iPad the same lists are pages of a navigation stack,
/// as the system's own settings are, and Done puts them away.
struct SettingsScreen: View {
    /// Every competition the proxy serves, shown or not.
    let leagues: [LeagueSummary]
    /// The apps How to Watch points at, for the Apps page and Debug's Open apps.
    var apps: [String: WatchApp] = [:]

    @State private var page = SettingsScreen.requested
    #if os(iOS)
    /// The lists opened from the top one, on a phone's stack.
    @State private var path: [SettingsPage] = SettingsScreen.requested == .top ? [] : [SettingsScreen.requested]
    #endif
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

    /// The system's own language, named after the device the app is on.
    private var systemLanguage: String {
        #if os(tvOS)
        return String(localized: "settings.languageSystem", bundle: LanguageChoice.bundle)
        #else
        return String(localized: "settings.languageDevice", bundle: LanguageChoice.bundle)
        #endif
    }

    var body: some View {
        #if os(tvOS)
        television
        #else
        NavigationStack(path: $path) {
            list(for: .top)
                .navigationTitle(Text(SettingsPage.top.title))
                .navigationDestination(for: SettingsPage.self) { page in
                    list(for: page).navigationTitle(Text(page.title))
                }
                .toolbar {
                    Button { dismiss() } label: { Text("settings.done").bold() }
                        .accessibilityIdentifier("settings.done")
                }
        }
        // The rows' words in the text's colour, not the tint's.
        .tint(.primary)
        .accessibilityIdentifier("page.settings")
        #endif
    }

    @ViewBuilder
    private func list(for page: SettingsPage) -> some View {
        switch page {
        case .top: topList
        case .competitions: CompetitionsChoiceSection(leagues: leagues)
        case .countries: CountriesChoiceSection()
        case .language: languageList
        case .apps: AppsChoiceSection(apps: apps)
        case .openApps: OpenAppsSection(apps: apps)
        }
    }

    /// `-TVScoresSettings countries` opens on that list (CI screenshots),
    /// from the first frame: a list pushed while a phone's sheet rose never
    /// showed (CI, 2026-11-12).
    private static var requested: SettingsPage {
        guard let wanted = LaunchRequest.argument("-TVScoresSettings") else { return .top }
        let asked = ["countries": SettingsPage.countries, "competitions": .competitions, "language": .language, "apps": .apps, "openApps": .openApps][wanted] ?? .top
        return asked == .openApps && !Edition.current.hasTesterTools ? .top : asked
    }

    #if os(tvOS)
    /// The television's page: the title, what it is for on the left, the list on the right.
    private var television: some View {
        VStack(spacing: Metrics.settingsTitleGap) {
            Text(page.title)
                .font(.title3.weight(.bold))
            HStack(alignment: .top, spacing: Metrics.settingsGap) {
                explanation
                    .frame(maxWidth: .infinity)
                list(for: page)
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
    #endif

    private var chosenCountries: String {
        let names = choice.countries.map { LanguageChoice.locale.localizedString(forRegionCode: $0) ?? $0 }
        return names.isEmpty ? String(localized: "settings.none", bundle: LanguageChoice.bundle) : names.joined(separator: ", ")
    }

    private var topList: some View {
        List {
            link(.competitions) {
                LabeledContent("settings.competitions") { Text(verbatim: shownCount) }
            }
            .accessibilityIdentifier("settings.competitions")
            link(.countries) {
                LabeledContent("settings.watch") { Text(verbatim: chosenCountries) }
            }
            .accessibilityIdentifier("settings.watch")
            link(.apps) {
                LabeledContent("settings.apps") { Text(verbatim: appsShown) }
            }
            .accessibilityIdentifier("settings.apps")
            link(.language) {
                LabeledContent("settings.language") { Text(verbatim: language.map(LanguageChoice.name) ?? systemLanguage) }
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
                    link(.openApps) {
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

    /// "34 of 49": the apps How to Watch offers.
    private var appsShown: String {
        let shown = apps.keys.filter { appChoice.isShown($0) }.count
        return String(localized: "settings.shownCount \(shown) \(apps.count)", bundle: LanguageChoice.bundle)
    }

    private var shownCount: String {
        let shown = leagues.filter { leagueChoice.isShown(MenuItem.key($0)) }.count
        return String(localized: "settings.shownCount \(shown) \(leagues.count)", bundle: LanguageChoice.bundle)
    }

    private var languageList: some View {
        List {
            ForEach([String?.none] + LanguageChoice.codes.map(Optional.some), id: \.self) { code in
                Button {
                    LanguageChoice.set(code)
                    language = code
                } label: {
                    HStack {
                        Text(verbatim: code.map(LanguageChoice.name) ?? systemLanguage)
                        Spacer()
                        if language == code { Image(systemName: "checkmark") }
                    }
                }
                .accessibilityIdentifier("settings.language.\(code ?? "system")")
            }
        }
    }

    /// A row that opens one of the lists: slid in beside the explanation on
    /// a television, pushed on a phone's stack.
    @ViewBuilder
    private func link<Content: View>(_ target: SettingsPage, @ViewBuilder label: () -> Content) -> some View {
        #if os(tvOS)
        Button(action: { page = target }, label: label)
        #else
        NavigationLink(value: target, label: label)
        #endif
    }

    /// A fact, not a choice: a row the remote can stand on, as tvOS's own.
    @ViewBuilder
    private func fact(_ label: LocalizedStringKey, _ value: String) -> some View {
        #if os(tvOS)
        Button {} label: {
            LabeledContent(label) { Text(verbatim: value) }
        }
        #else
        // A phone's row is too narrow for the sources beside their name.
        VStack(alignment: .leading, spacing: .tv(4)) {
            Text(label)
            Text(verbatim: value).font(.subheadline).foregroundStyle(.secondary)
        }
        #endif
    }
}

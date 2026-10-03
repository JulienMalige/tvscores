import SwiftUI

/// Settings, from the gear at the top of the menu, laid out as tvOS's own
/// settings pages are (Julien, build 36, from the Apple TV's Settings): the
/// page's title on top; on the left a large picture and a sentence saying
/// what this page is for; on the right the list. Choosing a row slides the
/// next list in on the right while the left explains it, and Back returns.
///
/// - the top: Where to watch (its countries as the value), Sources, Version;
/// - Where to watch: a checklist of countries — none, one or several.
struct SettingsScreen: View {
    private enum Page { case top, countries }

    @State private var page = Page.top
    @State private var choice = ChannelChoice.shared
    @Environment(\.dismiss) private var dismiss

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(short) (\(build))"
    }

    var body: some View {
        VStack(spacing: Metrics.settingsTitleGap) {
            Text(page == .top ? "settings.title" : "settings.watch")
                .font(.title3.weight(.bold))
            HStack(alignment: .top, spacing: Metrics.settingsGap) {
                explanation
                    .frame(maxWidth: .infinity)
                Group {
                    if page == .top { topList } else { countryList }
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
        .onExitCommand { if page == .top { dismiss() } else { page = .top } }
        .accessibilityIdentifier("page.settings")
        .task {
            // `-TVScoresSettings countries` opens on that list (CI screenshots).
            let args = ProcessInfo.processInfo.arguments
            if let i = args.firstIndex(of: "-TVScoresSettings"), i + 1 < args.count, args[i + 1] == "countries" { page = .countries }
        }
    }

    /// The left: what this page is for.
    @ViewBuilder
    private var explanation: some View {
        VStack(spacing: 40) {
            if page == .top {
                CourtMark()
                    .frame(width: Metrics.settingsMark, height: Metrics.settingsMark * 0.6)
            } else {
                Image(systemName: "tv")
                    .font(.system(size: Metrics.settingsMark * 0.5, weight: .light))
                    .frame(height: Metrics.settingsMark * 0.6)
            }
            Text(page == .top ? "settings.blurb" : "settings.countryNote")
                .font(.callout.weight(.medium))
                .multilineTextAlignment(.center)
                .frame(maxWidth: Metrics.settingsMark * 1.2)
        }
        .padding(.top, Metrics.settingsTitleGap)
    }

    private var chosenCountries: String {
        let names = choice.countries.map { Locale.current.localizedString(forRegionCode: $0) ?? $0 }
        return names.isEmpty ? String(localized: "settings.none") : names.joined(separator: ", ")
    }

    private var topList: some View {
        List {
            Button { page = .countries } label: {
                LabeledContent("settings.watch") { Text(verbatim: chosenCountries) }
            }
            .accessibilityIdentifier("settings.watch")
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

    /// A fact, not a choice: a row the remote can stand on, as tvOS's own.
    private func fact(_ label: LocalizedStringKey, _ value: String) -> some View {
        Button {} label: {
            LabeledContent(label) { Text(verbatim: value) }
        }
    }
}

/// The app's icon, drawn: a tennis court from above in white on blue, as
/// scripts/make-brand-assets.py draws it for the home screen.
struct CourtMark: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let cw = w * 0.64, ch = cw / 1.56
            let x = (w - cw) / 2, y = (h - ch) / 2
            let line = cw * 0.024
            ZStack {
                RoundedRectangle(cornerRadius: h * 0.12, style: .continuous)
                    .fill(LinearGradient(colors: [Color(red: 0.09, green: 0.53, blue: 0.93), Color(red: 0.03, green: 0.24, blue: 0.62)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                Path { p in
                    p.addRoundedRect(in: CGRect(x: x, y: y, width: cw, height: ch), cornerSize: CGSize(width: cw * 0.09, height: cw * 0.09))
                    for f in [0.2, 0.8] {
                        p.move(to: CGPoint(x: x, y: y + ch * f)); p.addLine(to: CGPoint(x: x + cw, y: y + ch * f))
                    }
                    for f in [0.14, 0.86] {
                        p.move(to: CGPoint(x: x + cw * f, y: y + ch * 0.2)); p.addLine(to: CGPoint(x: x + cw * f, y: y + ch * 0.8))
                    }
                    p.move(to: CGPoint(x: x + cw * 0.14, y: y + ch / 2)); p.addLine(to: CGPoint(x: x + cw * 0.86, y: y + ch / 2))
                    p.move(to: CGPoint(x: x + cw / 2, y: y)); p.addLine(to: CGPoint(x: x + cw / 2, y: y + ch))
                }
                .stroke(Color.white, lineWidth: line)
            }
        }
        .accessibilityHidden(true)
    }
}

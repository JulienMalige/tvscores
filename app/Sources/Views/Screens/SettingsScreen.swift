import SwiftUI

/// Settings, from the gear at the top of the menu, laid out as tvOS's own
/// settings pages are (Julien, build 36, from TestFlight's): the app's mark
/// large on the left with what it is and where its facts come from — which
/// the TV guides' terms ask us to say — and on the right the system's list,
/// a row per choice with its value at the end. For now it chooses whose TV
/// channels are shown: none, one country or several.
struct SettingsScreen: View {
    @State private var choice = ChannelChoice.shared

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(short) (\(build))"
    }

    var body: some View {
        HStack(alignment: .center, spacing: Metrics.settingsGap) {
            about
                .frame(maxWidth: .infinity)
            List {
                Section {
                    ForEach(ChannelChoice.all, id: \.self) { country in
                        Toggle(isOn: Binding(get: { choice.isOn(country) }, set: { _ in choice.toggle(country) })) {
                            HStack(spacing: 18) {
                                FlagMark(flag: ChannelChoice.flag(country), size: Metrics.settingsFlag)
                                Text(verbatim: Locale.current.localizedString(forRegionCode: country) ?? country)
                            }
                        }
                        .accessibilityIdentifier("settings.country.\(country)")
                    }
                } header: {
                    Text("settings.watch")
                } footer: {
                    Text("settings.countryNote")
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, Metrics.settingsMargin)
        .padding(.vertical, Metrics.screenBottom)
        .background(PageTint(color: .homeTint))
        .ignoresSafeArea()
        .accessibilityIdentifier("page.settings")
    }

    /// The left column: the mark, the name and version, the sources.
    private var about: some View {
        VStack(spacing: 28) {
            CourtMark()
                .frame(width: Metrics.settingsMark, height: Metrics.settingsMark * 0.6)
            Text("app.title")
                .font(.title3.weight(.bold))
            VStack(spacing: 10) {
                Text("settings.version") + Text(verbatim: " ") + Text(verbatim: version).foregroundStyle(.primary)
                Text("settings.scores") + Text(verbatim: " TheSportsDB, Live Tennis API, Orange Cat, Jolpica").foregroundStyle(.primary)
                Text("settings.listings") + Text(verbatim: " TheSportsDB, XML TV Fr, epgshare01").foregroundStyle(.primary)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
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

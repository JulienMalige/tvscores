import SwiftUI

/// Settings, from the gear at the top of the menu (Julien, build 33): the
/// same card over the page as a game's, its blocks on the same panels. For
/// now it says what is fixed — the country whose channels are shown — and
/// where the app's facts come from, which the TV guide's terms ask us to say.
struct SettingsScreen: View {
    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "–"
        let build = info?["CFBundleVersion"] as? String ?? "–"
        return "\(short) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Metrics.gameGap) {
                Text("settings.title")
                    .font(.title3.weight(.bold))
                    .padding(.top, Metrics.gameInset / 2)
                GameCard(title: "settings.watch", identifier: "settings.watch") {
                    VStack(spacing: 14) {
                        InfoLine(symbol: "tv", label: "settings.country", value: Text(verbatim: Locale.current.localizedString(forRegionCode: "FR") ?? "France"))
                        Text("settings.countryNote")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                GameCard(title: "settings.data", identifier: "settings.data") {
                    VStack(spacing: 14) {
                        InfoLine(symbol: "sportscourt", label: "settings.scores", value: Text(verbatim: "TheSportsDB, Live Tennis API, Orange Cat, Jolpica"))
                        InfoLine(symbol: "tv", label: "settings.listings", value: Text(verbatim: "TheSportsDB, XML TV Fr"))
                    }
                }
                GameCard(title: "settings.about", identifier: "settings.about") {
                    InfoLine(symbol: "info.circle", label: "settings.version", value: Text(verbatim: version))
                }
            }
            .font(.callout)
            .eventPageInsets()
        }
        .eventSheet(Color(white: 0.11))
        .accessibilityIdentifier("page.settings")
    }
}

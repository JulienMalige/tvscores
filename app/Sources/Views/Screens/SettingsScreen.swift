import SwiftUI

/// Settings, from the gear at the top of the menu (Julien, build 33): the
/// same card over the page as a game's, its blocks on the same panels. For
/// now it chooses whose TV channels are shown — none, one country or several
/// (build 36) — and says where the app's facts come from, which the TV
/// guides' terms ask us to say.
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
                ChannelCountriesSection()
                GameCard(title: "settings.data", identifier: "settings.data") {
                    VStack(spacing: 14) {
                        InfoLine(symbol: "sportscourt", label: "settings.scores", value: Text(verbatim: "TheSportsDB, Live Tennis API, Orange Cat, Jolpica"))
                        InfoLine(symbol: "tv", label: "settings.listings", value: Text(verbatim: "TheSportsDB, XML TV Fr, " + String(localized: "settings.otherGuides")))
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

/// "Where to watch": a switch per country whose channels the proxy knows.
/// Any number may be on, none included — then no channel shows anywhere.
private struct ChannelCountriesSection: View {
    @State private var choice = ChannelChoice.shared

    var body: some View {
        VStack(spacing: Metrics.rowGap) {
            Text("settings.watch")
                .font(.body.weight(.semibold))
                .padding(.bottom, Metrics.cardGap - Metrics.rowGap)
            ForEach(ChannelChoice.all, id: \.self) { country in
                Button { choice.toggle(country) } label: {
                    CountryRow(country: country, on: choice.isOn(country))
                }
                .buttonStyle(QuietButtonStyle())
                .accessibilityIdentifier("settings.country.\(country)")
            }
            Text("settings.countryNote")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Metrics.rowInsetH)
                .padding(.top, Metrics.rowGap)
        }
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .gameCardSurface(radius: Metrics.gameCardRadius)
    }
}

private struct CountryRow: View {
    let country: String
    let on: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 18) {
            Text(verbatim: ChannelChoice.flag(country)).font(.title3)
            Text(verbatim: Locale.current.localizedString(forRegionCode: country) ?? country)
                .font(.callout)
            Spacer()
            Image(systemName: on ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(on ? Color.green : Color.secondary)
        }
        .rowSurface(focused: isFocused, resting: 0, insetV: Metrics.tableRowPad)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

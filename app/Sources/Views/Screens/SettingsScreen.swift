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
                        InfoLine(symbol: "tv", label: "settings.listings", value: Text(verbatim: "TheSportsDB, XML TV Fr, epgshare01"))
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
/// Three layouts while Julien chooses (build 36); `-TVScoresSettingsStyle
/// rows|tiles|chips` picks one for the CI screenshots.
private struct ChannelCountriesSection: View {
    @State private var choice = ChannelChoice.shared

    private var style: String {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-TVScoresSettingsStyle"), i + 1 < args.count else { return "rows" }
        return args[i + 1]
    }

    var body: some View {
        VStack(spacing: Metrics.rowGap) {
            Text("settings.watch")
                .font(.body.weight(.semibold))
                .padding(.bottom, Metrics.cardGap - Metrics.rowGap)
            switch style {
            case "tiles":
                HStack(spacing: 28) { ForEach(ChannelChoice.all, id: \.self) { button($0) { CountryTile(country: $0, on: $1) } } }
                    .padding(.vertical, 12)
            case "chips":
                HStack(spacing: 20) { ForEach(ChannelChoice.all, id: \.self) { button($0) { CountryChip(country: $0, on: $1) } } }
                    .padding(.vertical, 12)
            default:
                ForEach(ChannelChoice.all, id: \.self) { country in
                    if country != ChannelChoice.all.first { RowRule() }
                    button(country) { CountryRow(country: $0, on: $1) }
                }
            }
            Text("settings.countryNote")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: style == "rows" ? .leading : .center)
                .padding(.horizontal, Metrics.rowInsetH)
                .padding(.top, Metrics.rowGap)
        }
        .padding(.vertical, Metrics.cardInsetV)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity)
        .gameCardSurface(radius: Metrics.gameCardRadius)
    }

    private func button<Label: View>(_ country: String, @ViewBuilder _ label: @escaping (String, Bool) -> Label) -> some View {
        Button { choice.toggle(country) } label: { label(country, choice.isOn(country)) }
            .buttonStyle(QuietButtonStyle())
            .accessibilityIdentifier("settings.country.\(country)")
    }
}

private func countryName(_ country: String) -> String {
    Locale.current.localizedString(forRegionCode: country) ?? country
}

/// A: as tvOS's own Settings — the name on the left, "On" or "Off" on the right.
private struct CountryRow: View {
    let country: String
    let on: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 18) {
            FlagMark(flag: ChannelChoice.flag(country), size: Metrics.settingsFlag)
            Text(verbatim: countryName(country)).font(.callout)
            Spacer()
            Text(on ? "settings.on" : "settings.off")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .rowSurface(focused: isFocused, resting: 0, insetV: Metrics.tableRowPad)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// B: a tile per country, its flag large; the chosen ones lit, with a tick.
private struct CountryTile: View {
    let country: String
    let on: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        VStack(spacing: 16) {
            FlagMark(flag: ChannelChoice.flag(country), size: Metrics.settingsTileFlag)
                .overlay(alignment: .bottomTrailing) {
                    if on {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title3)
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(.white, .green)
                    }
                }
                .opacity(on ? 1 : 0.45)
            Text(verbatim: countryName(country))
                .font(.callout.weight(on ? .semibold : .regular))
                .foregroundStyle(on ? .primary : .secondary)
        }
        .frame(width: Metrics.settingsTile)
        .padding(.vertical, 24)
        .focusGlass(isFocused, in: RoundedRectangle(cornerRadius: Metrics.rowRadius, style: .continuous), resting: on ? 0.08 : 0)
        .scaleEffect(isFocused ? 1.05 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// C: a capsule per country, filled when chosen.
private struct CountryChip: View {
    let country: String
    let on: Bool
    @Environment(\.isFocused) private var isFocused

    var body: some View {
        HStack(spacing: 12) {
            FlagMark(flag: ChannelChoice.flag(country), size: Metrics.channelFlag * 1.3)
            Text(verbatim: countryName(country)).font(.callout.weight(.medium))
            if on { Image(systemName: "checkmark").font(.caption.weight(.bold)) }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 22)
        .foregroundStyle(on ? Color.black : Color.primary)
        .background(Capsule().fill(on ? Color.white : Color.white.opacity(0.08)))
        .overlay(Capsule().stroke(Color.white.opacity(isFocused ? 0.6 : 0), lineWidth: 2))
        .scaleEffect(isFocused ? 1.06 : 1)
        .animation(.easeOut(duration: 0.15), value: isFocused)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

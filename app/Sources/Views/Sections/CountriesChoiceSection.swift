import SwiftUI

/// Settings, Where to watch: a checklist of countries — none, one or
/// several — whose channels the rows name, one row per country.
struct CountriesChoiceSection: View {
    @State private var choice = ChannelChoice.shared

    var body: some View {
        List {
            ForEach(ChannelChoice.all, id: \.self) { country in
                Button { choice.toggle(country) } label: {
                    HStack(spacing: .tv(18)) {
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
}

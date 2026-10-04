import SwiftUI

/// Settings, "Apps to show": every app How to Watch can offer, by country, ticked when it is
/// shown (Julien, 2026-10-04: "I prefer only Canal, I don't want some"). Turning one off only
/// hides it; the countries are those chosen under Where to watch, or all three when none is.
struct AppsChoiceSection: View {
    let apps: [String: WatchApp]
    @State private var choice = AppChoice.shared

    private static let kinds = ["own", "streamer", "provider"]

    private var countries: [String] {
        ChannelChoice.shared.countries.isEmpty ? ChannelChoice.all : ChannelChoice.shared.countries
    }

    /// The apps of a country: the channel's own first, then streaming services, then providers.
    private func keys(in country: String) -> [String] {
        apps.filter { $0.value.countries?.contains(country) ?? false }
            .sorted {
                let a = Self.kinds.firstIndex(of: $0.value.kind) ?? 9, b = Self.kinds.firstIndex(of: $1.value.kind) ?? 9
                return a == b ? $0.value.name < $1.value.name : a < b
            }
            .map(\.key)
    }

    var body: some View {
        List {
            ForEach(countries, id: \.self) { country in
                Section {
                    ForEach(keys(in: country), id: \.self) { key in
                        if let app = apps[key] {
                            Button { choice.toggle(key) } label: {
                                HStack(spacing: 18) {
                                    AppIconMark(app: app, height: Metrics.watchIconHeight * 0.5)
                                    Text(verbatim: app.name)
                                    Spacer()
                                    if choice.isShown(key) { Image(systemName: "checkmark") }
                                }
                            }
                            .accessibilityIdentifier("settings.app.\(key)")
                            .accessibilityAddTraits(choice.isShown(key) ? .isSelected : [])
                        }
                    }
                } header: {
                    HStack(spacing: 12) {
                        FlagMark(flag: ChannelChoice.flag(country), size: Metrics.settingsFlag)
                        Text(verbatim: LanguageChoice.locale.localizedString(forRegionCode: country) ?? country)
                    }
                }
            }
        }
    }
}

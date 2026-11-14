import SwiftUI

/// Settings, Usage Data: whether the app shares how it is used
/// (`UsageChoice`, docs/analytics.md). The television's row says On or Off
/// and a press turns it over, as tvOS's own settings do, with what sharing
/// sends on the left of the page (`SettingsPage.blurb`); a phone's is a
/// switch, with it underneath.
struct UsageChoiceSection: View {
    @State private var choice = UsageChoice.shared

    private var state: LocalizedStringKey { choice.shares ? "settings.on" : "settings.off" }

    var body: some View {
        List {
            #if os(tvOS)
            Button { set(!choice.shares) } label: {
                LabeledContent("settings.usage") { Text(state) }
            }
            .accessibilityIdentifier("settings.usage")
            .accessibilityValue(Text(state))
            #else
            Section {
                Toggle("settings.usage", isOn: Binding(get: { choice.shares }, set: { set($0) }))
                    // The system's green: Settings tints its rows white, and
                    // a white switch hid its knob (CI, 2026-11-14).
                    .tint(.green)
                    .accessibilityIdentifier("settings.usage")
            } footer: {
                // On a phone or a tablet the screens are recorded too, and it says so.
                Text("settings.usageNotePhone")
            }
            #endif
        }
    }

    private func set(_ shares: Bool) {
        choice.set(shares)
        Analytics.shared.apply(choice, from: "settings")
    }
}

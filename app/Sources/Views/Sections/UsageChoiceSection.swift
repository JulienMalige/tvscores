import SwiftUI

/// Settings, Privacy: whether the app shares how it is used (`UsageChoice`),
/// with what that sends in a line under it. The television's row says On or
/// Off and a press turns it over, as tvOS's own settings do; a phone's is a
/// switch.
struct UsageChoiceSection: View {
    @State private var choice = UsageChoice.shared

    /// On a phone or a tablet the screens are recorded too, and it says so.
    private static var note: LocalizedStringKey {
        #if os(tvOS)
        return "settings.usageNote"
        #else
        return "settings.usageNotePhone"
        #endif
    }

    private var state: LocalizedStringKey { choice.shares ? "settings.on" : "settings.off" }

    var body: some View {
        Section {
            #if os(tvOS)
            Button { set(!choice.shares) } label: {
                LabeledContent("settings.usage") { Text(state) }
            }
            .accessibilityIdentifier("settings.usage")
            .accessibilityValue(Text(state))
            #else
            Toggle("settings.usage", isOn: Binding(get: { choice.shares }, set: { set($0) }))
                .accessibilityIdentifier("settings.usage")
            #endif
        } header: {
            Text("settings.privacy")
        } footer: {
            Text(Self.note)
        }
    }

    private func set(_ shares: Bool) {
        choice.set(shares)
        Analytics.shared.apply(choice, from: "settings")
    }
}

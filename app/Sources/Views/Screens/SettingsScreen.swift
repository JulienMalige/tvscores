import SwiftUI

/// The one thing to set: who is watching. The name heads the menu and its
/// initials stand for a picture; each Apple TV user keeps their own.
struct SettingsScreen: View {
    @Bindable var profile: Profile

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Metrics.sectionGap / 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text("tab.settings")
                        .font(.system(size: 46, weight: .bold))
                        .accessibilityIdentifier("page.settings")
                    Spacer()
                    ClockLabel()
                }
                HStack(spacing: Metrics.headingGap) {
                    InitialsMark(initials: profile.initials, size: Metrics.markHero)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("settings.name")
                            .font(.title3.weight(.semibold))
                        TextField("settings.namePrompt", text: $profile.name)
                            .textFieldStyle(.plain)
                            .accessibilityIdentifier("settings.nameField")
                        Text("settings.nameHint")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .rowSurface(focused: false)
            }
            .pageMargins()
        }
    }
}

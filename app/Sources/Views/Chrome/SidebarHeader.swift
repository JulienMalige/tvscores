import SwiftUI

/// The top row of the menu, after the Apple TV app's: a round picture and
/// the name. It is the Home row. The Apple TV profile itself is not
/// something an app can read — `TVUserManager` hands over an opaque
/// identifier, and since tvOS 16 even the television's name reads "Apple
/// TV" — so the name is the one given in Settings and the picture its
/// initials, kept per Apple TV user. A sidebar row shows its title and
/// nothing more, so the time the TV app keeps here stays on the page.
struct SidebarHeader: View {
    let profile: Profile

    var body: some View {
        Label {
            if profile.name.isEmpty {
                Text("app.title")
                    .font(.title3.weight(.semibold))
            } else {
                Text(profile.name)
                    .font(.title3.weight(.semibold))
                    .lineLimit(1)
            }
        } icon: {
            InitialsMark(initials: profile.initials, size: Metrics.sidebarAvatar)
        }
        .accessibilityIdentifier("tab.home")
        .accessibilityLabel("Home")
    }
}

import SwiftUI

/// The top row of the menu: Home, with a house for its mark.
///
/// The Apple TV app heads its sidebar with the profile's picture and name.
/// That profile is not something an app can read — `TVUserManager` hands
/// over an opaque identifier and nothing else, Sign in with Apple would
/// give a name once and never a picture — so rather than a name typed into
/// the app (tried in build 21, dropped on 2026-09-19: "back to Home with a
/// house icon"), the first row says what it is.
struct SidebarHeader: View {
    var body: some View {
        Label("tab.home", systemImage: "house.fill")
            .accessibilityIdentifier("tab.home")
            .accessibilityLabel("Home")
    }
}

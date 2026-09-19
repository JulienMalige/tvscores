import SwiftUI

/// The top row of the menu, after the Apple TV app's: a round picture and
/// the name. It is the Home row. The Apple TV profile itself is not
/// something an app can read — `TVUserManager` hands over an opaque
/// identifier and nothing else — so the name is the television's own
/// ("Julien's Apple TV" gives "Julien") and the picture a placeholder until
/// the app has profiles of its own. A sidebar row shows its title and
/// nothing more, so the time the TV app keeps here stays on the page.
struct SidebarHeader: View {
    var body: some View {
        Label {
            Text(Self.viewerName)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
        } icon: {
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.white.opacity(0.85), Color.white.opacity(0.18))
                .frame(width: Metrics.sidebarAvatar, height: Metrics.sidebarAvatar)
        }
        .accessibilityIdentifier("tab.home")
        .accessibilityLabel("Home")
    }

    /// "Julien's Apple TV" → "Julien"; "Apple TV" alone → the app's name.
    static var viewerName: String {
        let device = UIDevice.current.name
        if let range = device.range(of: #"\s*(['’]s)?\s*Apple TV.*$"#, options: .regularExpression) {
            let owner = device[..<range.lowerBound].trimmingCharacters(in: .whitespaces)
            if !owner.isEmpty { return owner }
        } else if !device.isEmpty {
            return device
        }
        return String(localized: "app.title")
    }
}

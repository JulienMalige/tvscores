import SwiftUI

/// The top of the menu, as the Apple TV app has it: a round picture, the
/// name, the time in the lighter style. The Apple TV profile itself is not
/// something an app can read — no API hands over the viewer's picture or
/// name — so the name is the television's own ("Julien's Apple TV" gives
/// "Julien") and the picture a placeholder until the app has profiles.
struct SidebarHeader: View {
    var body: some View {
        HStack(spacing: 18) {
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .foregroundStyle(.white.opacity(0.85), Color.white.opacity(0.18))
                .frame(width: Metrics.sidebarAvatar, height: Metrics.sidebarAvatar)
            Text(Self.viewerName)
                .font(.title3.weight(.semibold))
                .lineLimit(1)
            Spacer()
            ClockLabel(showsDate: false)
        }
        .padding(.bottom, 24)
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

import SwiftUI

/// Settings, "Open apps (test)": every app How to Watch can point at, to try its links
/// from this Apple TV. tvOS documents no way to open another app, so what opens is
/// found out here, and every try goes to the trace (`AppOpener`), where it is read to
/// improve the table. Selecting an app tries its links in turn and shows what it tried.
struct OpenAppsSection: View {
    let apps: [String: WatchApp]
    /// The country whose store id to use: the first the viewer chose, or the France list's.
    private let country = ChannelChoice.shared.countries.first ?? "US"
    @State private var tried: [String: [AppOpener.Attempt]] = [:]

    var body: some View {
        List {
            ForEach(apps.keys.sorted(), id: \.self) { key in
                if let app = apps[key] {
                    Button {
                        Task { tried[key] = await AppOpener.open(app, key: key, country: country) }
                    } label: {
                        HStack(spacing: Metrics.watchCardGap) {
                            AppIconMark(app: app, size: Metrics.watchIcon * 0.7)
                            Text(verbatim: app.name)
                            Spacer()
                            Text(verbatim: summary(tried[key]))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityIdentifier("openapps.\(key)")
                }
            }
        }
    }

    /// "youtube:// ✗  https://apps.apple.com/… ✓", the links tried and what each answered.
    private func summary(_ attempts: [AppOpener.Attempt]?) -> String {
        guard let attempts else { return "" }
        return attempts.map { "\($0.link.prefix(34)) \($0.opened ? "✓" : "✗")" }.joined(separator: "  ")
    }
}

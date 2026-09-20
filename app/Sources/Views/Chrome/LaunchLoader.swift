import SwiftUI

/// What the app shows for the second before its pictures are ready.
///
/// Julien, on seeing a sidebar of soccerballs become badges: "I prefer to add
/// a small general loader than seeing the placeholder." So the first board and
/// its competition marks are waited for, and this stands in meanwhile.
///
/// When the first request has failed it says so under the spinner, rather
/// than spin in silence while the store tries again: a television that
/// cannot reach the proxy looked like an app stuck on loading (build 23).
struct LaunchLoader: View {
    /// The last failure, if the board has not come yet.
    var error: String?

    var body: some View {
        VStack(spacing: Metrics.headingGap) {
            Text("app.title")
                .font(.system(size: 46, weight: .bold))
            ProgressView()
            if error != nil {
                Text("launch.retrying")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("launch.retrying")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

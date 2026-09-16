import SwiftUI

/// What the app shows for the second before its pictures are ready.
///
/// Julien, on seeing a sidebar of soccerballs become badges: "I prefer to add
/// a small general loader than seeing the placeholder." So the first board and
/// its competition marks are waited for, and this stands in meanwhile.
struct LaunchLoader: View {
    var body: some View {
        VStack(spacing: Metrics.headingGap) {
            Text("app.title")
                .font(.system(size: 46, weight: .bold))
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

import SwiftUI

/// What the app shows for the second before its pictures are ready.
///
/// Julien, on seeing a sidebar of soccerballs become badges: "I prefer to add
/// a small general loader than seeing the placeholder." So the first board and
/// its competition marks are waited for, and this stands in meanwhile: the
/// app's own mark in the middle, breathing, and a bar that fills as the launch
/// does (Julien, 2026-10-03: "the logo in the middle and a progress bar").
///
/// When the first request has failed it says so under the bar, rather than
/// wait in silence while the store tries again: a television that cannot reach
/// the proxy looked like an app stuck on loading (build 23).
struct LaunchLoader: View {
    /// How far the launch is, 0 to 1.
    var progress: Double
    /// The last failure, if the board has not come yet.
    var error: String?
    @State private var breathing = false

    var body: some View {
        VStack(spacing: Metrics.sectionGap) {
            CourtMark()
                .frame(width: Metrics.launchMark, height: Metrics.launchMark * 0.6)
                .scaleEffect(breathing ? 1.03 : 0.98)
                .opacity(breathing ? 1 : 0.85)
            VStack(spacing: Metrics.headingGap) {
                Text("app.title")
                    .font(.system(size: 46, weight: .bold))
                bar
                if error != nil {
                    Text("launch.retrying")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("launch.retrying")
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { breathing = true } }
    }

    private var bar: some View {
        ZStack(alignment: .leading) {
            Capsule().fill(.quaternary)
            Capsule().fill(.primary)
                .frame(width: Metrics.launchBarWidth * min(1, max(0, progress)))
        }
        .frame(width: Metrics.launchBarWidth, height: Metrics.launchBarHeight)
        .animation(.easeOut(duration: 0.35), value: progress)
        .accessibilityElement()
        .accessibilityLabel(Text("app.title"))
        .accessibilityValue(Text(progress, format: .percent.precision(.fractionLength(0))))
        .accessibilityIdentifier("launch.progress")
    }
}

import SwiftUI

/// A choice between a few things — the day switch, the table switch under a
/// competition — the way the Apple TV app switches seasons: bare words, a
/// light pill on the one chosen, a white lifted pill on the one the remote
/// is on. A pill is chosen on click, not as focus passes over it, and there
/// is no track behind the row.
///
/// Not the system's segmented control, which draws a track it will not give
/// up and chooses a segment the moment focus reaches it — on a page where
/// pressing right moves *through* the switch, that changed the day under
/// people's feet. Focus is read from the environment inside the label, the
/// way the rows do it, so the pill lights up with the system's own timing.
struct Segments<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [(value: Value, title: LocalizedStringKey)]

    var body: some View {
        HStack(spacing: Metrics.pillGap) {
            ForEach(options, id: \.value) { option in
                Button {
                    selection = option.value
                } label: {
                    Pill(title: option.title, selected: selection == option.value)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    private struct Pill: View {
        let title: LocalizedStringKey
        let selected: Bool
        @Environment(\.isFocused) private var isFocused

        var body: some View {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(isFocused ? Color.black : Color.white)
                .padding(.vertical, Metrics.pillInsetV)
                .padding(.horizontal, Metrics.pillInsetH)
                .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(selected ? 0.32 : 0)))
                .scaleEffect(isFocused ? 1.08 : 1)
                .animation(.easeOut(duration: 0.15), value: isFocused)
        }
    }
}

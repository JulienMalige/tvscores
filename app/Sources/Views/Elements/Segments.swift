import SwiftUI

/// A choice between a few things — the day switch, the table switch under a
/// competition — as a row of pills on a track, the look of tvOS's segmented
/// control, chosen on click: the pill the remote is on white, the one chosen
/// light, the rest bare words.
///
/// Pills of ours rather than the system control, for one reason found on
/// the television: the system control keeps focus at its first segment on a
/// press left, so the menu could not be opened from it. SwiftUI buttons hand
/// focus to the sidebar as any row does. Borderless, so no platter of the
/// system's own appears behind the pill.
struct Segments<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [(value: Value, title: LocalizedStringKey)]

    var body: some View {
        HStack {
            HStack(spacing: Metrics.pillGap) {
                ForEach(options, id: \.value) { option in
                    Button {
                        selection = option.value
                    } label: {
                        Pill(title: option.title, selected: selection == option.value)
                    }
                    .buttonStyle(.borderless)
                    .focusEffectDisabled()
                }
            }
            .padding(Metrics.pillTrackInset)
            .background(Capsule().fill(Color.black.opacity(0.28)))
            Spacer()
        }
    }

    private struct Pill: View {
        let title: LocalizedStringKey
        let selected: Bool
        @Environment(\.isFocused) private var isFocused

        var body: some View {
            Text(title)
                .font(.callout.weight(.semibold))
                .foregroundStyle(isFocused ? Color.black : Color.white)
                .padding(.vertical, Metrics.pillInsetV)
                .padding(.horizontal, Metrics.pillInsetH)
                .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(selected ? 0.3 : 0)))
                .scaleEffect(isFocused ? 1.06 : 1)
                .animation(.easeOut(duration: 0.15), value: isFocused)
        }
    }
}

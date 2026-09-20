import SwiftUI

/// A choice between a few things — the day switch, the table switch under a
/// competition — as a row of pills the way the Apple TV app switches
/// seasons: bare words in grey, the one chosen on a light pill, the one the
/// remote is on white with dark words, no bar behind them, chosen on click.
/// Apple's own switch is buttons too, not the segmented control (whose
/// track cannot be removed); Julien asked for its look on 2026-09-20.
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
            Spacer()
        }
    }

    private struct Pill: View {
        let title: LocalizedStringKey
        let selected: Bool
        @Environment(\.isFocused) private var isFocused

        var body: some View {
            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(isFocused ? Color.black : selected ? Color.white : Color.secondary)
                .padding(.vertical, Metrics.pillInsetV)
                .padding(.horizontal, Metrics.pillInsetH)
                .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(selected ? 0.22 : 0)))
                .scaleEffect(isFocused ? 1.06 : 1)
                .animation(.easeOut(duration: 0.15), value: isFocused)
        }
    }
}

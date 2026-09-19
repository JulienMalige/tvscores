import SwiftUI

/// A choice between a few things — the day switch, the table switch under a
/// competition — as a row of pills the size of tvOS's segmented control,
/// without its track: the one chosen light, the one the remote is on white,
/// the rest bare words. A pill is chosen on click.
///
/// tvOS's own segmented control draws a track behind its segments that no
/// public setting clears — background image, background colour, its own
/// subviews were all tried on 2026-09-19 — so the row is ours, drawn on the
/// borderless button style, which lends the system's focus timing and adds
/// no platter of its own.
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
                .buttonStyle(.borderless)
                .focusEffectDisabled()
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

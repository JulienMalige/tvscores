import SwiftUI

/// A choice between a few things — the day switch, the competition switch
/// on a sport's page, the table switch under a competition — as a row of
/// pills the way the Apple TV app switches seasons: bare words in grey, the
/// one chosen on a light pill, the one the remote is on white with dark
/// words, no bar behind them, chosen on click. Apple's own switch is buttons
/// too, not the segmented control (whose track cannot be removed); Julien
/// asked for its look on 2026-09-20.
///
/// Pills of ours rather than the system control, for one reason found on
/// the television: the system control keeps focus at its first segment on a
/// press left, so the menu could not be opened from it. SwiftUI buttons hand
/// focus to the sidebar as any row does. Borderless, so no platter of the
/// system's own appears behind the pill.
struct Segments<Value: Hashable>: View {
    struct Option {
        let value: Value
        let title: Text
        /// A crest before the words, for a competition.
        var icon: URL? = nil
        /// For the flows, which find a pill by it.
        var identifier: String? = nil
    }

    @Binding var selection: Value
    let options: [Option]
    /// A row wider than the screen — Football's nine competitions and All —
    /// scrolls sideways as focus moves along it.
    var scrolls = false

    var body: some View {
        if scrolls {
            ScrollView(.horizontal, showsIndicators: false) { pills }
                .scrollClipDisabled()
        } else {
            HStack {
                pills
                Spacer()
            }
        }
    }

    private var pills: some View {
        HStack(spacing: Metrics.pillGap) {
            ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                Button {
                    selection = option.value
                } label: {
                    Pill(option: option, selected: selection == option.value)
                }
                .buttonStyle(.borderless)
                .focusEffectDisabled()
                .accessibilityIdentifier(option.identifier ?? "")
            }
        }
    }

    private struct Pill: View {
        let option: Option
        let selected: Bool
        @Environment(\.isFocused) private var isFocused

        var body: some View {
            HStack(spacing: Metrics.pillIconGap) {
                if let icon = option.icon {
                    CachedImage(url: icon) { EmptyView() }
                        .frame(width: Metrics.pillIcon, height: Metrics.pillIcon)
                }
                option.title
                    .font(.body.weight(.medium))
                    .lineLimit(1)
            }
            .foregroundStyle(isFocused ? Color.black : selected ? Color.white : Color.secondary)
            .padding(.vertical, Metrics.pillInsetV)
            .padding(.horizontal, Metrics.pillInsetH)
            .background(Capsule().fill(isFocused ? Color.white : Color.white.opacity(selected ? 0.22 : 0)))
            .scaleEffect(isFocused ? 1.06 : 1)
            .animation(.easeOut(duration: 0.15), value: isFocused)
        }
    }
}

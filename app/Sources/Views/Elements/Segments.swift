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
/// focus on as any row does. Borderless, so no platter of the system's own
/// appears behind the pill.
struct Segments<Value: Hashable>: View {
    struct Option {
        let value: Value
        let title: Text
    }

    @Binding var selection: Value
    let options: [Option]
    /// Takes focus onto the chosen pill when the switch first appears — for
    /// the day switch at the top of a page, which is where a page should
    /// start. Never for a switch further down: it would pull focus away.
    var claimsFocus = false
    /// The pill the remote is on, by position.
    @FocusState private var focused: Int?
    @State private var claimed = false

    var body: some View {
        HStack {
            HStack(spacing: Metrics.pillGap) {
                ForEach(Array(options.enumerated()), id: \.offset) { index, option in
                    Button {
                        selection = option.value
                    } label: {
                        Pill(title: option.title, selected: selection == option.value)
                    }
                    .buttonStyle(.borderless)
                    .focusEffectDisabled()
                    .focused($focused, equals: index)
                }
            }
            // Focus arriving on the switch lands on the pill chosen, not the
            // first: a page opened on Today starts on Today (Julien,
            // 2026-09-28: "yesterday is focused when in fact today is active").
            .defaultFocus($focused, options.firstIndex { $0.value == selection })
            // The hint above is not enough for a page made as the menu shuts:
            // the engine has already put focus on the first pill by then
            // (CI, 2026-09-28). So the day switch moves it to the chosen
            // pill — but only if focus is still on one of its own pills. Any
            // move the viewer made in the meantime (down to a row, left into
            // the menu, back to a race's row) is left alone.
            .task {
                guard claimsFocus, !claimed else { return }
                claimed = true
                try? await Task.sleep(for: .milliseconds(450))
                guard !Task.isCancelled, focused != nil else { return }
                focused = options.firstIndex { $0.value == selection }
            }
            Spacer()
        }
    }

    private struct Pill: View {
        let title: Text
        let selected: Bool
        @Environment(\.isFocused) private var isFocused

        var body: some View {
            title
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

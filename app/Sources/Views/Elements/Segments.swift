import SwiftUI
import UIKit

/// A choice between a few things — the day switch, the table switch under a
/// competition — as tvOS's own segmented control, chosen on click.
///
/// The control moves its highlight with focus and, left to itself, changes
/// its value with it; here the value reaches the page only when the remote
/// is pressed, and if focus leaves without a press the highlight snaps back
/// to what the page shows. Julien is fine with the control's own track and
/// wants the page to change only on a click.
struct Segments<Value: Hashable>: UIViewRepresentable {
    @Binding var selection: Value
    let options: [(value: Value, title: String)]

    func makeUIView(context: Context) -> ClickToChooseSegmentedControl {
        let control = ClickToChooseSegmentedControl(items: options.map(\.title))
        control.onCommit = { index in context.coordinator.commit(index) }
        control.setContentHuggingPriority(.required, for: .horizontal)
        control.setContentCompressionResistancePriority(.required, for: .horizontal)
        return control
    }

    func updateUIView(_ control: ClickToChooseSegmentedControl, context: Context) {
        context.coordinator.parent = self
        let index = options.firstIndex { $0.value == selection } ?? 0
        control.committed = index
        if !control.isFocused, control.selectedSegmentIndex != index { control.selectedSegmentIndex = index }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator {
        var parent: Segments
        init(parent: Segments) { self.parent = parent }

        func commit(_ index: Int) {
            guard parent.options.indices.contains(index) else { return }
            parent.selection = parent.options[index].value
        }
    }
}

/// tvOS's segmented control, with its value held back until the click.
final class ClickToChooseSegmentedControl: UISegmentedControl {
    /// The segment the page shows; what the highlight returns to.
    var committed = 0
    var onCommit: (Int) -> Void = { _ in }

    override init(items: [Any]?) {
        super.init(items: items)
    }

    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    /// The remote's select press, taken at the press level: on tvOS the
    /// control's own actions fire on the focus-driven change too, so they
    /// cannot tell a click from a move.
    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if presses.contains(where: { $0.type == .select }) {
            committed = selectedSegmentIndex
            onCommit(selectedSegmentIndex)
        }
        super.pressesEnded(presses, with: event)
    }

    override func didUpdateFocus(in context: UIFocusUpdateContext, with coordinator: UIFocusAnimationCoordinator) {
        super.didUpdateFocus(in: context, with: coordinator)
        // Focus gone elsewhere without a press: back to the day shown.
        let leaving = context.nextFocusedView.map { !$0.isDescendant(of: self) } ?? true
        if leaving, selectedSegmentIndex != committed { selectedSegmentIndex = committed }
    }
}

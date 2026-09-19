import SwiftUI
import UIKit

/// A choice between a few things — the day switch, the table switch under a
/// competition — as tvOS's own segmented control, without the dark track it
/// draws behind the segments. The segment the remote is on is white, the
/// chosen one light, the rest bare words; a segment is chosen as focus
/// reaches it, as in the Apple TV app's season switch.
///
/// UIKit's control, not SwiftUI's picker: the picker draws a track that no
/// appearance setting reaches, and pills of our own on the plain button
/// style came out larger and lost the system's focus feel. This is the same
/// control as in builds 17 and 18, with its track cleared at creation.
struct Segments<Value: Hashable>: UIViewRepresentable {
    @Binding var selection: Value
    let options: [(value: Value, title: String)]

    func makeUIView(context: Context) -> UISegmentedControl {
        let control = UISegmentedControl(items: options.map(\.title))
        control.setBackgroundImage(UIImage(), for: .normal, barMetrics: .default)
        control.setDividerImage(UIImage(), forLeftSegmentState: .normal, rightSegmentState: .normal, barMetrics: .default)
        control.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .valueChanged)
        control.setContentHuggingPriority(.required, for: .horizontal)
        control.setContentCompressionResistancePriority(.required, for: .horizontal)
        return control
    }

    func updateUIView(_ control: UISegmentedControl, context: Context) {
        context.coordinator.parent = self
        let index = options.firstIndex { $0.value == selection } ?? 0
        if control.selectedSegmentIndex != index { control.selectedSegmentIndex = index }
        clearTrack(control)
    }

    /// tvOS draws the track as a subview of its own that spans the control,
    /// and ignores the background image that clears it elsewhere. That view
    /// is found by its shape — the one as wide as the control, with a
    /// background — and made clear; the segments and their highlights are
    /// narrower and untouched.
    private func clearTrack(_ control: UISegmentedControl) {
        control.backgroundColor = .clear
        DispatchQueue.main.async {
            for view in control.subviews where view.bounds.width >= control.bounds.width - 1 && !(view is UILabel) {
                view.backgroundColor = .clear
                view.layer.backgroundColor = UIColor.clear.cgColor
                for inner in view.subviews where inner.bounds.width >= control.bounds.width - 1 && !(inner is UILabel) {
                    inner.backgroundColor = .clear
                    inner.layer.backgroundColor = UIColor.clear.cgColor
                }
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator {
        var parent: Segments
        init(parent: Segments) { self.parent = parent }

        @objc func changed(_ control: UISegmentedControl) {
            let index = control.selectedSegmentIndex
            guard parent.options.indices.contains(index) else { return }
            parent.selection = parent.options[index].value
        }
    }
}

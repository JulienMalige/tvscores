import SwiftUI

/// A choice between a few things, as the system's segmented control: the day
/// switch, and the table switch under a competition. tvOS chooses a segment
/// as focus reaches it, draws the one the remote is on in white and the
/// chosen one in grey, and the focus behaviour comes for free. The track it
/// draws behind the segments is cleared at launch (see `TVScoresApp`).
struct Segments<Value: Hashable>: View {
    @Binding var selection: Value
    let options: [(value: Value, title: LocalizedStringKey)]

    var body: some View {
        HStack {
            Picker("", selection: $selection) {
                ForEach(options, id: \.value) { option in
                    Text(option.title).tag(option.value)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            Spacer()
        }
    }
}

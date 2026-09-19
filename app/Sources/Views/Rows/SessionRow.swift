import SwiftUI

/// One session of a race weekend: what it is, and when.
struct SessionRow: View {
    let session: Session
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack {
            Text(title)
                .font(.title3.weight(.semibold))
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(session.start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Text(session.start, format: .dateTime.hour().minute())
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
            }
        }
        .rowSurface(focused: isFocused)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier("session.\(session.kind)")
    }

    /// The three a person looks for get their word in every language; a
    /// second qualifying or a shootout keeps the name the series gives it.
    private var title: LocalizedStringKey {
        switch session.kind {
        case "qualifying" where session.name.lowercased() == "qualifying": "session.qualifying"
        case "sprint" where session.name.lowercased() == "sprint": "session.sprint"
        case "race": "session.race"
        default: LocalizedStringKey(session.name)
        }
    }
}

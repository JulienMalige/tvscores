import SwiftUI

/// One session of a race weekend: what it is, and when.
struct SessionRow: View {
    let session: Session
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack {
            Text(title)
                .font(.callout)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(session.start, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                    .font(.callout)
                Text(session.start, format: .dateTime.hour().minute())
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
        }
        .rowSurface(focused: isFocused, resting: 0, insetV: Metrics.tableRowPad)
        .focusable()
        .focused($isFocused)
        .accessibilityIdentifier("session.\(session.kind)")
    }

    private var title: LocalizedStringKey { session.title }
}

extension Session {
    /// The three a person looks for get their word in every language; a
    /// second qualifying or a shootout keeps the name the series gives it.
    var title: LocalizedStringKey {
        switch kind {
        case "qualifying" where name.lowercased() == "qualifying": "session.qualifying"
        case "sprint" where name.lowercased() == "sprint": "session.sprint"
        case "race": "session.race"
        default: LocalizedStringKey(name)
        }
    }

    /// The same title as a string, for a caption joined with other words.
    var localizedTitle: String {
        switch kind {
        case "qualifying" where name.lowercased() == "qualifying": String(localized: "session.qualifying", bundle: LanguageChoice.bundle)
        case "sprint" where name.lowercased() == "sprint": String(localized: "session.sprint", bundle: LanguageChoice.bundle)
        case "race": String(localized: "session.race", bundle: LanguageChoice.bundle)
        default: name
        }
    }
}

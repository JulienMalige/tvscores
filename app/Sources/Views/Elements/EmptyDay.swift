import SwiftUI

/// A quiet state, as Apple Sports words it under its day switch: one line,
/// bold and centred — "No Events Today", "No Events for 7 Days". A
/// competition between seasons uses the same line, with when it is back
/// in grey under it, on a panel of the same size.
struct EmptyDay: View {
    let title: Text
    var line: Text?

    init(day: Day) {
        switch day {
        case .yesterday: title = Text("empty.yesterday")
        case .today: title = Text("empty.today")
        case .upcoming: title = Text("empty.upcoming")
        }
    }

    init(title: Text, line: Text?) {
        self.title = title
        self.line = line
    }

    var body: some View {
        VStack(spacing: 12) {
            title
                .font(.headline)
            if let line {
                line
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Metrics.cardInsetV * 1.5)
    }
}

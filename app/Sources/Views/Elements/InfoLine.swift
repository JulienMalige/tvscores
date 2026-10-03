import SwiftUI

/// One fact on an Information block: a grey symbol, a grey label, then the
/// value — "Time: Saturday 10 October", "Country: France".
struct InfoLine: View {
    let symbol: String
    let label: LocalizedStringKey
    let value: Text

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).foregroundStyle(.secondary)
            Text(label).foregroundStyle(.secondary) + Text(verbatim: " ") + value
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

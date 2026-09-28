import SwiftUI

/// What a day with no fixtures looks like: a symbol and a line on the front
/// page, the line alone on a sport's page, where the table sits under it.
struct EmptyDay: View {
    var compact = false

    var body: some View {
        VStack(spacing: 16) {
            if !compact {
                Image(systemName: "sportscourt")
                    .font(.system(size: 64))
                    .foregroundStyle(.secondary)
            }
            Text("home.empty")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, compact ? 24 : 0)
        .frame(maxWidth: .infinity, minHeight: compact ? nil : 500)
    }
}

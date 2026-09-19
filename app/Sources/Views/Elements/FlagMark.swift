import SwiftUI

/// A country's flag as a round mark, the size of a crest: the identity image
/// of a race, the way a badge is a club's and a portrait a driver's.
struct FlagMark: View {
    let flag: String?
    var size: CGFloat = Metrics.mark

    var body: some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.18))
            if let flag, !flag.isEmpty {
                Text(flag)
                    .font(.system(size: size * 0.78))
                    .frame(width: size, height: size)
                    .clipShape(Circle())
            } else {
                Image(systemName: "flag.checkered")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: size, height: size)
    }
}

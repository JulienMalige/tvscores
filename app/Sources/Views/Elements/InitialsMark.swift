import SwiftUI

/// A person without a picture, the way tvOS shows one: initials on a
/// coloured disc. The colour follows the name, so two people differ.
struct InitialsMark: View {
    let initials: String?
    var size: CGFloat = Metrics.mark

    var body: some View {
        ZStack {
            Circle().fill(colour)
            if let initials {
                Text(initials)
                    .font(.system(size: size * 0.4, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
            } else {
                Image(systemName: "person.fill")
                    .font(.system(size: size * 0.42))
                    .foregroundStyle(.white.opacity(0.9))
            }
        }
        .frame(width: size, height: size)
    }

    private var colour: Color {
        guard let initials else { return Color.white.opacity(0.22) }
        let hues: [Double] = [0.58, 0.02, 0.33, 0.75, 0.12, 0.48, 0.90]
        let index = Int(initials.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }) % hues.count
        return Color(hue: hues[index], saturation: 0.55, brightness: 0.85)
    }
}

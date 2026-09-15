import SwiftUI

/// The mark for a person: coloured disc, cutout photo clipped inside, round flag
/// badge at the bottom-right. Falls back to a monogram when there is no photo.
struct PersonMark: View {
    let photo: URL?
    let flag: String?
    var color: Color? = nil
    var monogram: String = ""
    var size: CGFloat = Metrics.mark

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle().fill(color ?? Color.white.opacity(0.18))
                if let photo {
                    AsyncImage(url: photo) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .scaledToFill()
                                .frame(width: size, height: size)
                                .offset(y: size * 0.06)
                        } else {
                            monogramText
                        }
                    }
                } else {
                    monogramText
                }
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
            if let flag, !flag.isEmpty {
                Text(flag)
                    .font(.system(size: size * 0.34))
                    .frame(width: size * 0.42, height: size * 0.42)
                    .background(Circle().fill(Color.black.opacity(0.85)))
                    .clipShape(Circle())
                    .offset(x: size * 0.06, y: size * 0.06)
            }
        }
        .frame(width: size, height: size)
    }

    /// "M. Marquez" -> "MAR", "Jannik Sinner" -> "SIN": first letters of the surname.
    static func monogram(for name: String) -> String {
        let surname = name.split(separator: " ").last.map(String.init) ?? name
        return String(surname.prefix(3)).uppercased()
    }

    private var monogramText: some View {
        Text(monogram)
            .font(.system(size: size * 0.3, weight: .heavy, design: .rounded))
            .foregroundStyle(.white)
    }
}

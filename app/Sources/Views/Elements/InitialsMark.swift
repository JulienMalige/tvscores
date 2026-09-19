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

    private var colour: Color { Color(uiColor: Self.colour(for: initials)) }

    /// The disc's colour follows the name, so two people differ.
    static func colour(for initials: String?) -> UIColor {
        guard let initials else { return UIColor.white.withAlphaComponent(0.22) }
        let hues: [CGFloat] = [0.58, 0.02, 0.33, 0.75, 0.12, 0.48, 0.90]
        let index = Int(initials.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }) % hues.count
        return UIColor(hue: hues[index], saturation: 0.55, brightness: 0.85, alpha: 1)
    }

    /// The same disc as a bitmap, for the one place that takes only an
    /// image: a sidebar row's icon slot, which draws nothing but an `Image`.
    static func image(initials: String?, size: CGFloat) -> UIImage {
        let scale: CGFloat = 2
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: {
            let f = UIGraphicsImageRendererFormat.default()
            f.scale = scale
            f.opaque = false
            return f
        }())
        return renderer.image { context in
            let rect = CGRect(x: 0, y: 0, width: size, height: size)
            colour(for: initials).setFill()
            context.cgContext.fillEllipse(in: rect)
            let text = initials ?? "•"
            let font = UIFont.systemFont(ofSize: size * 0.4, weight: .semibold)
            let style = NSMutableParagraphStyle()
            style.alignment = .center
            let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: UIColor.white, .paragraphStyle: style]
            let height = font.lineHeight
            (text as NSString).draw(in: CGRect(x: 0, y: (size - height) / 2, width: size, height: height), withAttributes: attributes)
        }
    }
}

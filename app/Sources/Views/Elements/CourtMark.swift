import SwiftUI

/// The app's icon, drawn: a tennis court from above in white on blue, as
/// scripts/make-brand-assets.py draws it for the home screen.
struct CourtMark: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let cw = w * 0.64, ch = cw / 1.56
            let x = (w - cw) / 2, y = (h - ch) / 2
            let line = cw * 0.024
            ZStack {
                RoundedRectangle(cornerRadius: h * 0.12, style: .continuous)
                    .fill(LinearGradient(colors: [Color(red: 0.09, green: 0.53, blue: 0.93), Color(red: 0.03, green: 0.24, blue: 0.62)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                Path { p in
                    p.addRoundedRect(in: CGRect(x: x, y: y, width: cw, height: ch), cornerSize: CGSize(width: cw * 0.09, height: cw * 0.09))
                    for f in [0.2, 0.8] {
                        p.move(to: CGPoint(x: x, y: y + ch * f)); p.addLine(to: CGPoint(x: x + cw, y: y + ch * f))
                    }
                    for f in [0.14, 0.86] {
                        p.move(to: CGPoint(x: x + cw * f, y: y + ch * 0.2)); p.addLine(to: CGPoint(x: x + cw * f, y: y + ch * 0.8))
                    }
                    p.move(to: CGPoint(x: x + cw * 0.14, y: y + ch / 2)); p.addLine(to: CGPoint(x: x + cw * 0.86, y: y + ch / 2))
                    p.move(to: CGPoint(x: x + cw / 2, y: y)); p.addLine(to: CGPoint(x: x + cw / 2, y: y + ch))
                }
                .stroke(Color.white, lineWidth: line)
            }
        }
        .accessibilityHidden(true)
    }
}

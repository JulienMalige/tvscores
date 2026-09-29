import Foundation
import CoreGraphics

/// Three ways to use the television's width, on trial side by side (Julien,
/// build 29): a phone's list stretched to 16:9 leaves a wide gap between
/// each score and the middle. Picked at launch with `-TVScoresLayout`, so
/// CI takes the same screens every way; the default is unchanged.
enum Layout {
    enum Mode: String {
        /// Panels across the whole width, as now.
        case full
        /// 1. A centred column, as Apple Sports on an iPad or a Mac.
        case column
        /// 2. Full-width panels, each row's content kept to the middle.
        case compact
        /// 3. Games two a line.
        case columns
    }

    static let mode: Mode = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-TVScoresLayout"), i + 1 < args.count else { return .full }
        return Mode(rawValue: args[i + 1]) ?? .full
    }()

    static var columns: Bool { mode == .columns }
    /// Option 1: how wide a page's content may be.
    static var pageWidth: CGFloat { mode == .column ? 1400 : .infinity }
    /// Option 2: how wide a row's content may be, the row itself full width.
    static var rowWidth: CGFloat { mode == .compact ? 1150 : .infinity }
}

import Foundation

/// The clock behind a page's figures (`UsageTracker`): Page Viewed when the
/// page comes into sight, Page Left with its seconds when it goes. The same
/// page on another day, or another game, is the old one left and the new
/// one viewed; a game whose state moves on is still the page it was, and is
/// left as it was viewed. Kept out of the view so the tests can run it.
struct PageClock {
    private var viewed: (page: UsageEvent.Page, since: Date)?

    /// What to send for `page`, in sight or not, at `now`.
    mutating func update(_ page: UsageEvent.Page, inSight: Bool, now: Date = .now) -> [UsageEvent] {
        var events: [UsageEvent] = []
        if let viewed, !inSight || viewed.page.identity != page.identity {
            events.append(.pageLeft(viewed.page, seconds: Int(now.timeIntervalSince(viewed.since).rounded())))
            self.viewed = nil
        }
        if inSight, viewed == nil {
            viewed = (page, now)
            events.append(.pageViewed(page))
        }
        return events
    }
}

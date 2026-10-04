import UIKit

/// Opens an app from this Apple TV, or finds out that it cannot.
///
/// tvOS has no documented way to open another app or its App Store page: an app
/// opens by a URL scheme it registered, if it did. So the links are tried in turn,
/// the app's schemes and then the store's, and every try is written to the trace
/// (`POST /v1/diag`), which is how a real television tells us which ones work.
@MainActor
enum AppOpener {
    struct Attempt: Equatable {
        let link: String
        let opened: Bool
    }

    /// The store page of an app, in the forms an Apple TV may answer to.
    static func storeLinks(_ id: Int) -> [String] {
        ["https://apps.apple.com/app/id\(id)", "itms-apps://apps.apple.com/app/id\(id)", "com.apple.TVAppStore://app/id\(id)"]
    }

    /// Every link worth trying for an app, in order: its schemes, then its store pages.
    static func links(for app: WatchApp, country: String) -> [String] {
        (app.schemes ?? []) + (app.id?.value(for: country).map(storeLinks) ?? [])
    }

    /// Tries the links until one opens, and says what it tried.
    @discardableResult
    static func open(_ app: WatchApp, key: String, country: String) async -> [Attempt] {
        var tried: [Attempt] = []
        for link in links(for: app, country: country) {
            let result = await attempt(link, key: key)
            tried.append(result)
            if result.opened { break }
        }
        if tried.isEmpty { Diagnostics.shared.note("watch open \(key): nothing to try") }
        return tried
    }

    /// One link, and the system's answer, written to the trace.
    static func attempt(_ link: String, key: String) async -> Attempt {
        guard let url = URL(string: link) else { return Attempt(link: link, opened: false) }
        let opened = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            UIApplication.shared.open(url, options: [:]) { continuation.resume(returning: $0) }
        }
        Diagnostics.shared.note("watch open \(key) \(link) -> \(opened ? "opened" : "refused")")
        return Attempt(link: link, opened: opened)
    }
}

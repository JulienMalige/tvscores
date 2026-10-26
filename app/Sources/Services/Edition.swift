import Foundation

/// Which build this is: a tester's, or the one submitted to the store.
///
/// The store build leaves out what only a tester needs: the "Open apps
/// (test)" page and the trace posted to the proxy. Nothing at run time can
/// tell the two apart, because App Review runs a build the way TestFlight
/// does, in StoreKit's sandbox; so the line is drawn when the TestFlight
/// workflow archives it (`store: true`, docs/release.md), which writes
/// `TVScoresEdition` into Info.plist.
enum Edition: String {
    case tester
    case store

    static let current: Edition = {
        // A flow test can ask for the store build's face. Nothing can ask a
        // store build for the tester's tools.
        if ProcessInfo.processInfo.arguments.contains("-TVScoresStoreEdition") { return .store }
        return Edition(info: Bundle.main.infoDictionary ?? [:])
    }()

    /// A build without the key, or with a value we do not know, is a tester's.
    init(info: [String: Any]) {
        self = (info["TVScoresEdition"] as? String).flatMap(Edition.init(rawValue:)) ?? .tester
    }

    /// The "Open apps (test)" page, and the trace sent to the proxy.
    var hasTesterTools: Bool { self == .tester }
}

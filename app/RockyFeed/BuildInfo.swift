import Foundation

// Reads the stamp produced by the "Stamp build info" run-script phase.
//
// ⚠️ That build phase declares no inputs and no outputs, and it shells out to
// `git`. Xcode therefore has no idea what it depends on or what it produces, so
// it runs on *every* build — including builds where nothing changed. It is also
// the reason two builds of identical source can produce different bundles.
enum BuildInfo {
    private static let stamp: [String: Any] = {
        guard let url = Bundle.main.url(forResource: "BuildStamp", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil),
              let dictionary = plist as? [String: Any]
        else { return [:] }
        return dictionary
    }()

    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    static var build: String {
        stamp["commit"] as? String ?? "unknown"
    }

    static var builtAt: String {
        stamp["builtAt"] as? String ?? "unknown"
    }
}

import Foundation

// Reads the stamp produced by the "Stamp build info" run-script phase.
//
// ⚠️ That build phase declares no inputs and no outputs, and it shells out to
// `git`. Xcode therefore has no idea what it depends on or what it produces, so
// it runs on *every* build — including builds where nothing changed. It is also
// the reason two builds of identical source can produce different bundles.
public enum BuildInfo {
    // Typed as [String: String] rather than [String: Any] because Core is built in
    // Swift 6 language mode, where a static `[String: Any]` is not Sendable and so
    // not concurrency-safe. The stamp only ever holds strings, so this is what it
    // should have said in the first place.
    private static let stamp: [String: String] = {
        guard let url = Bundle.main.url(forResource: "BuildStamp", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let plist = try? PropertyListSerialization.propertyList(from: data, format: nil),
              let dictionary = plist as? [String: String]
        else { return [:] }
        return dictionary
    }()

    public static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    }

    public static var build: String {
        stamp["commit"] ?? "unknown"
    }

    public static var builtAt: String {
        stamp["builtAt"] ?? "unknown"
    }
}

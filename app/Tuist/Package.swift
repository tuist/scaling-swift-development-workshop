// swift-tools-version: 6.0
import PackageDescription

// Third-party dependencies, resolved by `tuist install`.
//
// Same two packages, same versions as before. Tuist resolves them with SwiftPM
// and then integrates them as Xcode targets rather than as a package graph the
// IDE has to interpret — which is what makes them cacheable later.
let package = Package(
    name: "RockyFeed",
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher", from: "7.11.0"),
    ]
)

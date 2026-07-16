// swift-tools-version: 6.0
import PackageDescription

// ⚠️ This is the "god module".
//
// `Core` holds *everything* shared: models, networking, image loading, the
// design system, session, storage, formatting… Every feature in the app imports
// it. That means every change to Core invalidates the whole build graph — there
// is no such thing as a small change here.
//
// It also owns the third-party dependencies (Alamofire, Kingfisher), so the
// whole app transitively pulls them in through a single door.
let package = Package(
    name: "Core",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "Core", targets: ["Core"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher", from: "7.11.0"),
    ],
    targets: [
        .target(
            name: "Core",
            dependencies: [
                .product(name: "Alamofire", package: "Alamofire"),
                .product(name: "Kingfisher", package: "Kingfisher"),
            ]
        ),
    ]
)

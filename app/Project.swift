import ProjectDescription

// RockyFeed, described in Swift instead of stored in a pbxproj.
//
// This is a straight translation of what was already here — the same three
// targets, the same settings, the same monolithic Core. Nothing gets faster in
// this task, and that is the point: first we change *how* the project is
// defined, then we change *what* it says.
//
// What did change: RockyFeed.xcodeproj is now generated and gitignored. It is a
// build artefact, like a .o file. Nobody merges those.

let project = Project(
    name: "RockyFeed",
    packages: [
        .remote(url: "https://github.com/Alamofire/Alamofire", requirement: .upToNextMajor(from: "5.9.0")),
        .remote(url: "https://github.com/onevcat/Kingfisher", requirement: .upToNextMajor(from: "7.11.0")),
    ],
    targets: [
        .target(
            name: "RockyFeed",
            destinations: .iOS,
            product: .app,
            bundleId: "dev.tuist.rockyfeed",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "UILaunchScreen": [:],
                "UISupportedInterfaceOrientations": ["UIInterfaceOrientationPortrait"],
            ]),
            sources: ["RockyFeed/**"],
            scripts: [
                // Still declaring no inputs and no outputs, still shelling out to
                // git. We have not fixed this — we have only moved where it is
                // written down. It comes back to bite us later.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    basedOnDependencyAnalysis: false
                ),
            ],
            dependencies: [
                .target(name: "Core"),
            ]
        ),
        // ⚠️ The god module, faithfully preserved. 82 files, one target, and it
        // owns both third-party dependencies. Task 4 is where this changes.
        .target(
            name: "Core",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.core",
            deploymentTargets: .iOS("17.0"),
            sources: ["Core/Sources/Core/**"],
            dependencies: [
                .package(product: "Alamofire"),
                .package(product: "Kingfisher"),
            ]
        ),
        .target(
            name: "RockyFeedTests",
            destinations: .iOS,
            product: .unitTests,
            bundleId: "dev.tuist.rockyfeed.tests",
            deploymentTargets: .iOS("17.0"),
            sources: ["RockyFeedTests/**"],
            dependencies: [
                .target(name: "RockyFeed"),
                .target(name: "Core"),
            ]
        ),
    ]
)

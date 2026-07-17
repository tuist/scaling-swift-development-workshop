import ProjectDescription

// RockyFeed, with the god module taken apart.
//
// The rule, applied honestly: a module may not depend on something it does not
// use. Everything below follows from that.
//
// BEFORE — one Core, one app target, and a chain:
//
//   Alamofire  Kingfisher
//        └────┬────┘
//             ▼
//           Core              waiting on an HTTP client it barely uses
//             ▼
//         RockyFeed           every feature, one target
//
// AFTER — the shape from the talk. Features on top, services beneath,
// foundations at the bottom, and no arrows inside a layer:
//
//   Models       DesignSystem            Alamofire   Kingfisher
//        │            │    │                 │           │
//        │            │    └──────── Images ─│───────────┘
//        │            │              │       ▼
//        │            │              │  Networking
//        └────────────│──────────────│───────┘
//                     │              ▼
//                     │         Domain
//                     ▼              ▼
//     FeatureLogin  FeatureFeed  FeatureSearch  FeaturePlayer
//              FeatureProfile  FeatureSettings          ← six, in parallel
//                             ▼
//                         RockyFeed                     ← three files
//
// Nothing moved on disk. A module boundary is a manifest decision — `sources:`
// takes globs, and the folders already said what belonged together.

let coreRoot = "Core/Sources/Core"

/// Every feature needs the design system, the models, and the app's logic.
let featureBase: [TargetDependency] = [
    .target(name: "DesignSystem"),
    .target(name: "Models"),
    .target(name: "Domain"),
]

func feature(_ name: String, needsImages: Bool = false) -> Target {
    .target(
        name: "Feature\(name)",
        destinations: .iOS,
        product: .framework,
        bundleId: "dev.tuist.rockyfeed.feature\(name.lowercased())",
        deploymentTargets: .iOS("17.0"),
        sources: ["RockyFeed/Features/\(name)/**"],
        dependencies: needsImages ? featureBase + [.target(name: "Images")] : featureBase
    )
}

let project = Project(
    name: "RockyFeed",
    packages: [
        .remote(url: "https://github.com/Alamofire/Alamofire", requirement: .upToNextMajor(from: "5.9.0")),
        .remote(url: "https://github.com/onevcat/Kingfisher", requirement: .upToNextMajor(from: "7.11.0")),
    ],
    targets: [
        // The app is now three files: it starts up and picks a tab.
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
            sources: ["RockyFeed/*.swift"],
            scripts: [
                // Still no declared inputs or outputs, still shelling out to git.
                // Not fixed, only relocated. It comes back to bite us later.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    basedOnDependencyAnalysis: false
                ),
            ],
            dependencies: [
                .target(name: "FeatureLogin"),
                .target(name: "FeatureFeed"),
                .target(name: "FeatureSearch"),
                .target(name: "FeaturePlayer"),
                .target(name: "FeatureProfile"),
                .target(name: "FeatureSettings"),
                .target(name: "DesignSystem"),
                .target(name: "Domain"),
            ]
        ),

        // ── Features ──────────────────────────────────────────────────────────
        // Six targets, ~16 files each, none depending on another. This is the work
        // that used to be one 90-file queue.
        feature("Login"),
        feature("Feed"),
        feature("Search"),
        feature("Player", needsImages: true),
        feature("Profile", needsImages: true),
        feature("Settings"),

        // ── Services ──────────────────────────────────────────────────────────

        // The only target that needs Alamofire. One file.
        .target(
            name: "Networking",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.networking",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Networking/**"],
            dependencies: [.package(product: "Alamofire")]
        ),

        // RemoteImage is the file that fights you: it imports Kingfisher *and*
        // calls Theme. Leave it in the design system and every component goes back
        // to waiting on an image library — the original problem, in miniature. So
        // it lives alone and pays for its own dependency.
        .target(
            name: "Images",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.images",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Images/**"],
            dependencies: [
                .target(name: "DesignSystem"),
                .package(product: "Kingfisher"),
            ]
        ),

        // ⚠️ NOT "CoreServices" — that is an Apple system framework, and naming a
        // module after it makes Clang resolve <CoreServices/CoreServices.h> to
        // yours. Kingfisher and Alamofire then fail to build MobileCoreServices,
        // with an error mentioning neither your module nor your code.
        .target(
            name: "Domain",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.domain",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Session/**",
                "\(coreRoot)/Storage/**",
                "\(coreRoot)/Feed/**",
                "\(coreRoot)/Ranking/**",
                "\(coreRoot)/Services/**",
            ],
            dependencies: [
                .target(name: "Models"),
                .target(name: "Networking"),
            ]
        ),

        // ── Foundation ────────────────────────────────────────────────────────
        // Both depend on nothing, so both start at t=0 — alongside Alamofire and
        // Kingfisher rather than behind them.

        .target(
            name: "Models",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.models",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Models/**",
                "\(coreRoot)/Formatting/**",
                "\(coreRoot)/Fixtures/**",
                "\(coreRoot)/BuildInfo/**",
            ]
        ),

        .target(
            name: "DesignSystem",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.designsystem",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/DesignSystem/**",
                "\(coreRoot)/Components/**",
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
                .target(name: "Images"),
                .target(name: "Models"),
                .target(name: "Domain"),
            ]
        ),
    ]
)

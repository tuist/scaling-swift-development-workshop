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
//   CoreModels   CoreDesignSystem        Alamofire   Kingfisher
//        │            │    │                 │           │
//        │            │    └──── CoreImages ─│───────────┘
//        │            │              │       ▼
//        │            │              │  CoreNetworking
//        └────────────│──────────────│───────┘
//                     │              ▼
//                     │         CoreDomain
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
    .target(name: "CoreDesignSystem"),
    .target(name: "CoreModels"),
    .target(name: "CoreDomain"),
]

func feature(_ name: String, needsImages: Bool = false) -> Target {
    .target(
        name: "Feature\(name)",
        destinations: .iOS,
        product: .framework,
        bundleId: "dev.tuist.rockyfeed.feature\(name.lowercased())",
        deploymentTargets: .iOS("17.0"),
        sources: ["RockyFeed/Features/\(name)/**"],
        dependencies: needsImages ? featureBase + [.target(name: "CoreImages")] : featureBase
    )
}

let project = Project(
    name: "RockyFeed",
    settings: .settings(
        base: [
            "SWIFT_VERSION": "5.0",
            "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
            "ENABLE_USER_SCRIPT_SANDBOXING": "NO",
            // Task 5. Set on the project so it reaches the package targets too —
            // Alamofire and Kingfisher are most of a clean build, and setting this
            // on the app target alone would cache the small half.
            "COMPILATION_CACHE_ENABLE_CACHING": "YES",
        ],
        configurations: [
            .debug(name: "Debug", settings: ["ONLY_ACTIVE_ARCH": "YES"]),
            .release(name: "Release"),
        ]
    ),
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
                // Task 8. This phase used to run on every build, including no-op
                // ones, because it told Xcode nothing about what it read or wrote
                // — and then `basedOnDependencyAnalysis: false` told Xcode not to
                // think about it either.
                //
                // Now it declares both, so Xcode skips it unless the commit
                // actually moved. .git/HEAD is the honest input: it is the thing
                // the script reads, so it is the thing that should re-trigger it.
                .post(
                    path: "Scripts/stamp-build-info.sh",
                    name: "Stamp build info",
                    inputPaths: ["$(SRCROOT)/../.git/HEAD"],
                    outputPaths: [
                        "$(BUILT_PRODUCTS_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/BuildStamp.plist",
                    ]
                ),
            ],
            dependencies: [
                .target(name: "FeatureLogin"),
                .target(name: "FeatureFeed"),
                .target(name: "FeatureSearch"),
                .target(name: "FeaturePlayer"),
                .target(name: "FeatureProfile"),
                .target(name: "FeatureSettings"),
                .target(name: "CoreDesignSystem"),
                .target(name: "CoreDomain"),
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
            name: "CoreNetworking",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.corenetworking",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Networking/**"],
            dependencies: [.external(name: "Alamofire")]
        ),

        // RemoteImage is the file that fights you: it imports Kingfisher *and*
        // calls Theme. Leave it in the design system and every component goes back
        // to waiting on an image library — the original problem, in miniature. So
        // it lives alone and pays for its own dependency.
        .target(
            name: "CoreImages",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.coreimages",
            deploymentTargets: .iOS("17.0"),
            sources: ["\(coreRoot)/Images/**"],
            dependencies: [
                .target(name: "CoreDesignSystem"),
                .external(name: "Kingfisher"),
            ]
        ),

        // ⚠️ NOT "CoreServices" — that is an Apple system framework, and naming a
        // module after it makes Clang resolve <CoreServices/CoreServices.h> to
        // yours. Kingfisher and Alamofire then fail to build MobileCoreServices,
        // with an error mentioning neither your module nor your code.
        .target(
            name: "CoreDomain",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.coredomain",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Session/**",
                "\(coreRoot)/Storage/**",
                "\(coreRoot)/Feed/**",
                "\(coreRoot)/Ranking/**",
                "\(coreRoot)/Services/**",
            ],
            dependencies: [
                .target(name: "CoreModels"),
                .target(name: "CoreNetworking"),
            ]
        ),

        // ── Foundation ────────────────────────────────────────────────────────
        // Both depend on nothing, so both start at t=0 — alongside Alamofire and
        // Kingfisher rather than behind them.

        .target(
            name: "CoreModels",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.coremodels",
            deploymentTargets: .iOS("17.0"),
            sources: [
                "\(coreRoot)/Models/**",
                "\(coreRoot)/Formatting/**",
                "\(coreRoot)/Fixtures/**",
                "\(coreRoot)/BuildInfo/**",
            ]
        ),

        .target(
            name: "CoreDesignSystem",
            destinations: .iOS,
            product: .framework,
            bundleId: "dev.tuist.rockyfeed.coredesignsystem",
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
                .target(name: "CoreImages"),
                .target(name: "CoreModels"),
                .target(name: "CoreDomain"),
            ]
        ),
    ]
)

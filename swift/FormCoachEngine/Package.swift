// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FormCoachEngine",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [
        .library(name: "FormCoachEngine", targets: ["FormCoachEngine"]),
        .library(name: "FormCoachSummary", targets: ["FormCoachSummary"]),
        .library(name: "FormCoachInteraction", targets: ["FormCoachInteraction"]),
        .executable(name: "formcoach-review", targets: ["FormCoachReviewCLI"]),
    ],
    targets: [
        .target(name: "FormCoachEngine"),
        .target(name: "FormCoachSummary"),
        .target(name: "FormCoachInteraction", dependencies: ["FormCoachSummary"]),
        .executableTarget(name: "FormCoachReviewCLI", dependencies: ["FormCoachInteraction"]),
        // No resources: the tests read conformance-vectors.json and content-v4.8.json
        // from the repo root, the same files verify.mjs reads. A bundled copy went
        // stale once and reported 19 phantom divergences; there is now no copy.
        .testTarget(
            name: "FormCoachEngineTests",
            dependencies: ["FormCoachEngine"]
        ),
        .testTarget(
            name: "FormCoachSummaryTests",
            dependencies: ["FormCoachSummary"]
        ),
        .testTarget(
            name: "FormCoachInteractionTests",
            dependencies: ["FormCoachInteraction"]
        ),
    ]
)

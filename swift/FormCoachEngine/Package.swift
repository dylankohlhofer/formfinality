// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FormCoachEngine",
    platforms: [.iOS(.v16), .macOS(.v13)],
    products: [.library(name: "FormCoachEngine", targets: ["FormCoachEngine"])],
    targets: [
        .target(name: "FormCoachEngine"),
        .testTarget(
            name: "FormCoachEngineTests",
            dependencies: ["FormCoachEngine"],
            resources: [.copy("Vectors")]
        ),
    ]
)

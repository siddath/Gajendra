// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "GajendraCompanion",
    platforms: [.macOS("13.5")],
    products: [
        .library(name: "GajendraKit", targets: ["GajendraKit"]),
        .executable(name: "Gajendra", targets: ["GajendraApp"]),
        .executable(name: "GajendraPreview", targets: ["GajendraPreview"]),
        .executable(name: "GajendraSelfTest", targets: ["GajendraSelfTest"]),
        .executable(name: "GajendraUITest", targets: ["GajendraUITest"]),
    ],
    targets: [
        .target(name: "GajendraKit"),
        .executableTarget(name: "GajendraApp", dependencies: ["GajendraKit"]),
        .executableTarget(name: "GajendraPreview", dependencies: ["GajendraKit"]),
        .executableTarget(name: "GajendraSelfTest", dependencies: ["GajendraKit"]),
        .executableTarget(name: "GajendraUITest"),
    ]
)

// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "DaddyRadMCP",
    platforms: [.macOS(.v15)],
    products: [.executable(name: "daddyrad-mcp", targets: ["DaddyRadMCP"])],
    dependencies: [
        .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", exact: "0.12.1"),
        .package(url: "https://github.com/Significant-Hobbies/performancedaddy.git", revision: "439d06490d3e135942d4decc62fb96c9ddca0ced"),
        .package(url: "https://github.com/Significant-Hobbies/contextdaddy.git", revision: "46840971d1ead0be57c0c5f792b66a848e0a3218"),
        .package(url: "https://github.com/Significant-Hobbies/storagedaddy.git", revision: "44dbb36a596d102499ca8aafadc507340c10a270"),
        .package(url: "https://github.com/Significant-Hobbies/browserdaddy.git", revision: "82afe09470e9ab671e197db225873919b35f5b47"),
    ],
    targets: [
        .target(name: "DaddyDiagnostics", dependencies: [
            .product(name: "MCP", package: "swift-sdk"),
            .product(name: "PerformanceCore", package: "performancedaddy"),
            .product(name: "ContextCore", package: "contextdaddy"),
            .product(name: "DiskCore", package: "storagedaddy"),
            .product(name: "BrowserCore", package: "browserdaddy"),
        ]),
        .executableTarget(name: "DaddyRadMCP", dependencies: ["DaddyDiagnostics", .product(name: "MCP", package: "swift-sdk")]),
        .testTarget(name: "DaddyDiagnosticsTests", dependencies: ["DaddyDiagnostics"]),
    ]
)

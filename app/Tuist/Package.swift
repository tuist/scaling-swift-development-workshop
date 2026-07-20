// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RockyFeed",
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher", from: "7.11.0"),
    ]
)

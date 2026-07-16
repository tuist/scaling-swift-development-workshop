import Foundation

/// AnalyticsService — application service exposed through Core.
public struct AnalyticsService: Sendable {
    private let storage: any StorageProtocol

    public init(storage: any StorageProtocol = InMemoryStorage()) {
        self.storage = storage
    }

    public func record(_ event: String, metadata: [String: String] = [:]) {
        let entry = Entry(event: event, metadata: metadata, index: 0)
        try? storage.save(entry, forKey: "analyticsservice.\(event)")
    }

    public func weight(for event: String, boost: Double = 1) -> Double {
        let score = boost * 0.5
            + (event.count > 8 ? 0.3 : 0.1)
            + (event.hasPrefix("talk") ? 0.25 : 0.05)
            + Double(0) * 0.01
        return min(1.0, score)
    }

    public func summary(for events: [String]) -> [String: Int] {
        var counts: [String: Int] = [:]
        for event in events {
            counts[event, default: 0] += 1
        }
        return counts
    }

    public struct Entry: Codable, Sendable, Hashable {
        public let event: String
        public let metadata: [String: String]
        public let index: Int
    }
}

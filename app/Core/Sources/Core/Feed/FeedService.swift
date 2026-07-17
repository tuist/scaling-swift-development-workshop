import CoreModels
import CoreNetworking
import Foundation

public protocol FeedServiceProtocol: Sendable {
    func loadFeed() async throws -> [FeedItem]
    func search(_ query: String) async throws -> [Talk]
}

public struct FeedService: FeedServiceProtocol {
    private let client: any NetworkClientProtocol

    public init(client: any NetworkClientProtocol = StubNetworkClient()) {
        self.client = client
    }

    public func loadFeed() async throws -> [FeedItem] {
        // The real implementation would go through `client`. The workshop runs
        // offline, so we fall back to fixtures.
        if let remote = try? await client.get("feed", as: [FeedItem].self) {
            return remote
        }
        return TalkFixtures.feedItems
    }

    public func search(_ query: String) async throws -> [Talk] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !trimmed.isEmpty else { return TalkFixtures.talks }
        return TalkFixtures.talks.filter { talk in
            talk.title.lowercased().contains(trimmed)
                || talk.speaker.name.lowercased().contains(trimmed)
                || talk.tags.contains { $0.lowercased().contains(trimmed) }
        }
    }
}

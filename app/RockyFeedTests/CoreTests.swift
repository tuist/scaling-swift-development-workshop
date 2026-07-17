import Foundation
import Testing

import CoreDomain
import CoreImages
import CoreModels

// One test target for the entire app. There is no way to run "just the tests for
// the thing I changed" — the target is all-or-nothing, so every pull request pays
// for the whole suite.

@Suite("Formatters")
struct FormattersTests {
    @Test func formatsShortDurations() {
        #expect(Formatters.duration(25) == "25 min")
    }

    @Test func formatsHourDurations() {
        #expect(Formatters.duration(60) == "1 h")
        #expect(Formatters.duration(95) == "1 h 35 min")
    }

    @Test func formatsCompactCounts() {
        #expect(Formatters.compactCount(999) == "999")
        #expect(Formatters.compactCount(1_500) == "1.5k")
        #expect(Formatters.compactCount(2_400_000) == "2.4M")
    }
}

@Suite("Relevance scoring")
struct RelevanceScoringTests {
    @Test func bookmarkedItemsScoreHigher() {
        let item = TalkFixtures.feedItems[0]
        let plain = RelevanceScoring.score(for: item, bookmarked: false)
        let bookmarked = RelevanceScoring.score(for: item, bookmarked: true)
        #expect(bookmarked > plain)
    }

    @Test func scoreStaysInRange() {
        for item in TalkFixtures.feedItems {
            let score = RelevanceScoring.score(for: item, bookmarked: true)
            #expect(score >= 0.0 && score <= 1.0)
        }
    }

    @Test func freshnessDecaysOverTime() {
        #expect(RelevanceScoring.freshnessDecay(hours: 1) > RelevanceScoring.freshnessDecay(hours: 100))
    }

    @Test func keynotesOutrankCommunityTalks() {
        let keynote = RelevanceScoring.trackWeight(.keynote, interests: [])
        let community = RelevanceScoring.trackWeight(.community, interests: [])
        #expect(keynote > community)
    }
}

@Suite("Storage")
struct StorageTests {
    @Test func roundTripsAUser() throws {
        let storage = InMemoryStorage()
        let user = User(name: "Ada", email: "ada@example.com")
        try storage.save(user, forKey: "user")
        let loaded = try storage.load(User.self, forKey: "user")
        #expect(loaded == user)
    }

    @Test func removesValues() throws {
        let storage = InMemoryStorage()
        try storage.save(User(name: "Grace", email: "grace@example.com"), forKey: "user")
        storage.remove(forKey: "user")
        #expect(try storage.load(User.self, forKey: "user") == nil)
    }
}

@Suite("Feed service")
struct FeedServiceTests {
    @Test func loadsTheFeed() async throws {
        let service = FeedService()
        let items = try await service.loadFeed()
        #expect(!items.isEmpty)
    }

    @Test func searchMatchesTitles() async throws {
        let service = FeedService()
        let results = try await service.search("god module")
        #expect(results.count == 1)
    }

    @Test func searchMatchesSpeakers() async throws {
        let service = FeedService()
        let results = try await service.search("ada")
        #expect(!results.isEmpty)
    }

    @Test func emptyQueryReturnsEverything() async throws {
        let service = FeedService()
        let results = try await service.search("   ")
        #expect(results.count == TalkFixtures.talks.count)
    }
}

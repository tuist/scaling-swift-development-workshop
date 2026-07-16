import Foundation

// Ranking heuristics for the feed.
//
// ⚠️ These expressions are deliberately painful for the Swift type-checker: long
// arithmetic chains mixing Int and Double literals with inline ternaries. Each one
// is individually fine, but together they make this one file a measurable chunk of
// every Core build.
//
// Build with `-Xfrontend -warn-long-function-bodies=100` and this file lights up.
public enum RelevanceScoring {
    public static func score(for item: FeedItem, bookmarked: Bool, now: Date = Date()) -> Double {
        let ageHours = max(0, now.timeIntervalSince(item.talk.startsAt) / 3_600)
        let likes = Double(item.likeCount)
        let duration = Double(item.talk.durationMinutes)
        let tagCount = Double(item.talk.tags.count)

        let recency = 1.0 / (1.0 + ageHours / 24.0)
        let popularity = likes / (likes + 50.0)

        let base = recency * 0.4
            + popularity * 0.3
            + (bookmarked ? 0.2 : 0.0)
            + (item.talk.track == .keynote ? 0.15 : 0.0)
            + (tagCount > 1 ? 0.05 : 0.0)
            + (duration > 30 ? 0.05 : 0.02)
            + (item.isBookmarked ? 0.05 : 0.0)
            + (likes > 100 ? 0.05 : 0.0)
            + (ageHours < 2 ? 0.1 : 0.0)

        return min(1.0, max(0.0, base))
    }

    public static func trackWeight(_ track: Track, interests: [String]) -> Double {
        let matches = Double(interests.filter { $0.lowercased() == track.rawValue }.count)

        let weight = matches * 0.25
            + (track == .keynote ? 0.3 : 0.1)
            + (track == .performance ? 0.2 : 0.05)
            + (track == .testing ? 0.15 : 0.05)
            + (track == .tooling ? 0.15 : 0.05)
            + (interests.isEmpty ? 0.1 : 0.0)
            + (matches > 1 ? 0.1 : 0.0)

        return min(1.0, weight)
    }

    public static func freshnessDecay(hours: Double, halfLife: Double = 12) -> Double {
        let normalized = hours / halfLife
        let decay = 1.0 / (1.0 + normalized)
            + (hours < 1 ? 0.2 : 0.0)
            + (hours < 6 ? 0.1 : 0.0)
            + (hours > 48 ? -0.1 : 0.0)
            + (hours > 168 ? -0.1 : 0.0)

        return min(1.0, max(0.0, decay))
    }

    public static func rank(_ items: [FeedItem], session: UserSessionSnapshot) -> [FeedItem] {
        items
            .map { item in (item, score(for: item, bookmarked: session.bookmarks.contains(item.talk.id))) }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }
}

/// A plain snapshot of session state so ranking can stay off the main actor.
public struct UserSessionSnapshot: Sendable {
    public let bookmarks: Set<UUID>
    public let interests: [String]

    public init(bookmarks: Set<UUID> = [], interests: [String] = []) {
        self.bookmarks = bookmarks
        self.interests = interests
    }
}

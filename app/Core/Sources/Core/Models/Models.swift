import Foundation

// Domain models for RockyFeed — a small conference companion app for a fictional
// "Swift Rockies" event. Everything lives in Core, so every feature depends on it.

public struct Speaker: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public var name: String
    public var handle: String
    public var bio: String
    public var avatarURL: URL?

    public init(id: UUID = UUID(), name: String, handle: String, bio: String, avatarURL: URL? = nil) {
        self.id = id
        self.name = name
        self.handle = handle
        self.bio = bio
        self.avatarURL = avatarURL
    }
}

public struct Talk: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public var title: String
    public var abstract: String
    public var speaker: Speaker
    public var track: Track
    public var startsAt: Date
    public var durationMinutes: Int
    public var tags: [String]

    public init(
        id: UUID = UUID(),
        title: String,
        abstract: String,
        speaker: Speaker,
        track: Track,
        startsAt: Date,
        durationMinutes: Int,
        tags: [String] = []
    ) {
        self.id = id
        self.title = title
        self.abstract = abstract
        self.speaker = speaker
        self.track = track
        self.startsAt = startsAt
        self.durationMinutes = durationMinutes
        self.tags = tags
    }
}

public enum Track: String, CaseIterable, Codable, Sendable {
    case keynote
    case tooling
    case performance
    case testing
    case community

    public var displayName: String {
        switch self {
        case .keynote: return "Keynote"
        case .tooling: return "Tooling"
        case .performance: return "Performance"
        case .testing: return "Testing"
        case .community: return "Community"
        }
    }
}

public struct FeedItem: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public var talk: Talk
    public var likeCount: Int
    public var isBookmarked: Bool

    public init(id: UUID = UUID(), talk: Talk, likeCount: Int = 0, isBookmarked: Bool = false) {
        self.id = id
        self.talk = talk
        self.likeCount = likeCount
        self.isBookmarked = isBookmarked
    }
}

public struct User: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public var name: String
    public var email: String
    public var bookmarks: [UUID]

    public init(id: UUID = UUID(), name: String, email: String, bookmarks: [UUID] = []) {
        self.id = id
        self.name = name
        self.email = email
        self.bookmarks = bookmarks
    }
}

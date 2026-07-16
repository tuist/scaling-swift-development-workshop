import Foundation

// Sample data so the app has something to show without a live backend.
public enum TalkFixtures {
    public static let speakers: [Speaker] = [
        Speaker(name: "Ada Lovelace", handle: "@ada", bio: "Works on compilers and analytical engines."),
        Speaker(name: "Grace Hopper", handle: "@grace", bio: "Believes in tooling that meets people where they are."),
        Speaker(name: "Alan Kay", handle: "@alan", bio: "Interested in systems that stay simple as they grow."),
        Speaker(name: "Barbara Liskov", handle: "@barbara", bio: "Substitution, abstraction, and clear module boundaries."),
        Speaker(name: "Margaret Hamilton", handle: "@margaret", bio: "Software engineering, on the critical path."),
    ]

    public static let talks: [Talk] = {
        let base = Date(timeIntervalSince1970: 1_781_000_000)
        return [
            Talk(
                title: "How slow is too slow?",
                abstract: "There is no universal number. Slow is whatever breaks your flow.",
                speaker: speakers[0],
                track: .keynote,
                startsAt: base,
                durationMinutes: 45,
                tags: ["builds", "flow"]
            ),
            Talk(
                title: "Resolving packages without the wait",
                abstract: "SwiftPM clones every dependency with its full history. It doesn't have to.",
                speaker: speakers[1],
                track: .tooling,
                startsAt: base.addingTimeInterval(3_600),
                durationMinutes: 30,
                tags: ["spm", "registry"]
            ),
            Talk(
                title: "The god module",
                abstract: "Everything routes through Core. Change it, and every module is a cache miss.",
                speaker: speakers[2],
                track: .performance,
                startsAt: base.addingTimeInterval(7_200),
                durationMinutes: 30,
                tags: ["graph", "cache"]
            ),
            Talk(
                title: "Selective testing in practice",
                abstract: "Run only the tests a change can actually affect.",
                speaker: speakers[3],
                track: .testing,
                startsAt: base.addingTimeInterval(10_800),
                durationMinutes: 40,
                tags: ["tests", "ci"]
            ),
            Talk(
                title: "The slowest shard wins",
                abstract: "Shards run in parallel, so wall-clock is your slowest shard.",
                speaker: speakers[4],
                track: .testing,
                startsAt: base.addingTimeInterval(14_400),
                durationMinutes: 25,
                tags: ["sharding"]
            ),
            Talk(
                title: "Measuring local builds",
                abstract: "Teams watch CI closely and are blind to the builds on their own machines.",
                speaker: speakers[0],
                track: .performance,
                startsAt: base.addingTimeInterval(18_000),
                durationMinutes: 35,
                tags: ["local", "metrics"]
            ),
            Talk(
                title: "Killing flakiness",
                abstract: "Green stops meaning green. Retries waste the time you saved.",
                speaker: speakers[1],
                track: .testing,
                startsAt: base.addingTimeInterval(21_600),
                durationMinutes: 30,
                tags: ["flaky", "hermetic"]
            ),
            Talk(
                title: "Community and the platform team",
                abstract: "Scaling development is a people problem wearing a build-system costume.",
                speaker: speakers[2],
                track: .community,
                startsAt: base.addingTimeInterval(25_200),
                durationMinutes: 30,
                tags: ["team"]
            ),
        ]
    }()

    public static let feedItems: [FeedItem] = talks.enumerated().map { index, talk in
        FeedItem(talk: talk, likeCount: (index + 1) * 37, isBookmarked: index % 4 == 0)
    }
}

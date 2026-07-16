#!/usr/bin/env node
// Authoring tool. Generates the bulk of RockyFeed's source.
//
// WHY THIS EXISTS
//
// The workshop's headline metric is the "god module tax": what one line in Core
// costs you. A toy app cannot demonstrate that. With a dozen files, touching Core
// is indistinguishable from doing nothing, and the participant learns the exact
// opposite of the lesson.
//
// So we generate a plausible amount of ordinary app code. Two properties matter,
// and both are deliberate:
//
//   1. VOLUME + COST. Every file has a SwiftUI body and a mixed-arithmetic
//      computed property, so it costs the type-checker real time. This is the
//      talk's "expensive-to-compile files" in miniature.
//
//   2. SHAPE. Core is one module, so it must finish compiling before the app
//      target can start — everything waits on Core. Every generated app file
//      imports Core. That serialisation is the god module, and it's the thing we
//      measure now and remove later.
//
// File count is not the thing that makes a project painful to work in — build
// time is. Participants only ever open a handful of these.
//
// Participants never run this. Rerun only if reshaping the sample:
//
//   node maintainer/generate-bulk-sources.mjs
//
// ⚠️ This script writes .swift files but CANNOT add them to RockyFeed.xcodeproj —
// the project is hand-maintained on purpose (see maintainer/README.md). Change any
// of the name lists below and you must reflect it in Xcode by hand, or the new
// files won't compile. Editing the bodies of existing files is safe.
//
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreComponents = path.join(root, "app/Core/Sources/Core/Components");
const coreServices = path.join(root, "app/Core/Sources/Core/Services");

const TOKENS = ["accent", "labelPrimary", "labelSecondary", "labelTertiary", "success", "warning", "destructive"];
const token = (i) => TOKENS[i % TOKENS.length];
const spacing = (i) => ["xs", "sm", "md", "lg"][i % 4];

/**
 * A design-system component in Core.
 *
 * Reads Theme, so a Theme change rebuilds every one of these — and only then can
 * the app target start.
 */
const component = (name, i) => `import SwiftUI

/// ${name} — part of the RockyFeed design system.
public struct ${name}: View {
    private let title: String
    private let subtitle: String?
    private let badge: String?
    private let isHighlighted: Bool
    private let emphasis: Double

    public init(
        title: String,
        subtitle: String? = nil,
        badge: String? = nil,
        isHighlighted: Bool = false,
        emphasis: Double = ${(i % 5) / 10 + 0.5}
    ) {
        self.title = title
        self.subtitle = subtitle
        self.badge = badge
        self.isHighlighted = isHighlighted
        self.emphasis = emphasis
    }

    // Mixed Int/Double/CGFloat arithmetic with inline ternaries. Cheap to read,
    // expensive to type-check — which is the point.
    private var density: CGFloat {
        let weight = emphasis * 1.5
            + (isHighlighted ? 0.75 : 0.25)
            + (subtitle == nil ? 0.5 : 1.0)
            + (badge == nil ? 0.25 : 0.75)
            + (title.count > 24 ? 1.25 : 0.5)
            + Double(${i % 7}) * 0.125
        return Theme.Spacing.${spacing(i)} + CGFloat(weight)
    }

    private var accentOpacity: Double {
        emphasis * 0.4
            + (isHighlighted ? 0.35 : 0.1)
            + (badge == nil ? 0.05 : 0.15)
            + Double(${i % 4}) * 0.05
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            RoundedRectangle(cornerRadius: Theme.Radius.sm)
                .fill(Theme.color(.${token(i)}).opacity(accentOpacity))
                .frame(width: density, height: density * ${2 + (i % 3)})

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack(spacing: Theme.Spacing.xs) {
                    Text(title)
                        .font(Theme.font(.subheadline, weight: isHighlighted ? .semibold : .regular))
                        .foregroundStyle(Theme.color(.labelPrimary))
                        .lineLimit(${1 + (i % 2)})
                    if let badge {
                        Badge(badge, token: .${token(i + 1)})
                    }
                    Spacer(minLength: 0)
                }

                if let subtitle {
                    Text(subtitle)
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.color(.labelSecondary))
                        .lineLimit(${1 + (i % 3)})
                        .padding(.top, Theme.Spacing.xs / 2)
                }

                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: "${["clock", "person", "tag", "star", "bookmark", "mic"][i % 6]}")
                        .font(.caption2)
                        .foregroundStyle(Theme.color(.${token(i + 2)}))
                    Text(String(format: "%.1f", emphasis * 5))
                        .font(Theme.font(.caption2))
                        .foregroundStyle(Theme.color(.labelTertiary))
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(Theme.color(.labelTertiary))
                }
                .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.${spacing(i + 1)})
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md)
                .fill(Theme.color(.surfaceSecondary))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md)
                        .strokeBorder(
                            Theme.color(.${token(i)}).opacity(isHighlighted ? 0.4 : 0.0),
                            lineWidth: isHighlighted ? 1.5 : 0
                        )
                )
        )
    }
}
`;

/** A service in Core. */
const service = (name, i) => `import Foundation

/// ${name} — application service exposed through Core.
public struct ${name}: Sendable {
    private let storage: any StorageProtocol

    public init(storage: any StorageProtocol = InMemoryStorage()) {
        self.storage = storage
    }

    public func record(_ event: String, metadata: [String: String] = [:]) {
        let entry = Entry(event: event, metadata: metadata, index: ${i})
        try? storage.save(entry, forKey: "${name.toLowerCase()}.\\(event)")
    }

    public func weight(for event: String, boost: Double = 1) -> Double {
        let score = boost * 0.5
            + (event.count > 8 ? 0.3 : 0.1)
            + (event.hasPrefix("talk") ? 0.25 : 0.05)
            + Double(${i}) * 0.01
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
`;

/** A feature view in the app target. Imports Core — the tax is paid here. */
const featureView = (name, i) => `import Core
import SwiftUI

struct ${name}: View {
    let items: [FeedItem]

    private var totalMinutes: Int {
        items.reduce(0) { $0 + $1.talk.durationMinutes }
    }

    private var emphasis: Double {
        let base = Double(items.count) * 0.05
            + (items.contains { $0.isBookmarked } ? 0.3 : 0.1)
            + (totalMinutes > 90 ? 0.25 : 0.1)
            + Double(${i % 6}) * 0.05
        return min(1.0, base)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(spacing: Theme.Spacing.xs) {
                Text("${name.replace(/([A-Z])/g, " $1").trim()}")
                    .font(Theme.font(.headline))
                    .foregroundStyle(Theme.color(.labelPrimary))
                Spacer(minLength: 0)
                Badge(Formatters.compactCount(items.count), token: .${token(i)})
            }

            ForEach(items.prefix(${2 + (i % 4)})) { item in
                ${["TalkCard", "SessionCard", "SpeakerCard", "TrackCard", "AgendaRow", "BookmarkRow"][i % 6]}(
                    title: item.talk.title,
                    subtitle: item.talk.speaker.name,
                    badge: item.talk.track.displayName,
                    isHighlighted: item.isBookmarked,
                    emphasis: emphasis
                )
            }

            HStack(spacing: Theme.Spacing.sm) {
                Text(Formatters.duration(totalMinutes))
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
                Text(Formatters.compactCount(items.reduce(0) { $0 + $1.likeCount }))
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
                Spacer(minLength: 0)
            }
            .padding(.top, Theme.Spacing.xs)
        }
        .padding(Theme.Spacing.md)
        .background(Theme.color(.surfacePrimary))
    }
}
`;

// Names are plausible rather than Component1…N: this should read like an app
// someone actually shipped, not like generated filler.
const COMPONENTS = [
  "TalkCard", "SessionCard", "SpeakerCard", "TrackCard", "AgendaRow", "BookmarkRow",
  "TagChip", "AvatarTile", "StatTile", "EmptyStateCard", "BannerCard", "NoticeRow",
  "ScheduleHeader", "TrackLegend", "RatingRow", "ShareRow", "TimelineRow", "VenueCard",
  "SponsorCard", "HighlightCard", "ProgressRow", "CountdownCard", "FilterChip", "SortRow",
  "RoomCard", "FloorPlanRow", "BreakCard", "WorkshopCard", "LightningRow", "PanelCard",
  "QuestionRow", "PollCard", "FeedbackRow", "SurveyCard", "TranscriptRow", "CaptionRow",
  "ChapterRow", "QueueRow", "DownloadRow", "OfflineCard", "SyncRow", "ConflictCard",
  "ReminderRow", "CalendarCard", "MapRow", "TravelCard", "HotelRow", "WeatherCard",
  "SocialRow", "MentionCard", "ThreadRow", "ReplyCard", "ReactionRow", "BadgeCard",
  "StreakRow", "LevelCard", "AchievementRow", "LeaderboardCard", "InviteRow", "TeamCard",
];

const SERVICES = [
  "AnalyticsService", "BookmarkService", "NotificationService", "ScheduleService",
  "RatingService", "ShareService", "VenueService", "SponsorService",
  "TranscriptService", "DownloadService", "CalendarService", "SocialService",
];

const FEATURES = {
  Feed: [
    "FeedHighlights", "FeedTrackSection", "FeedUpcoming", "FeedBookmarks", "FeedTrending",
    "FeedRecap", "FeedSponsors", "FeedNotices", "FeedLive", "FeedNearby", "FeedForYou", "FeedHistory",
  ],
  Search: [
    "SearchSuggestions", "SearchRecents", "SearchByTrack", "SearchBySpeaker", "SearchEmpty",
    "SearchFilters", "SearchResultsGrid", "SearchTags", "SearchPopular", "SearchSaved",
  ],
  Profile: [
    "ProfileStats", "ProfileBookmarks", "ProfileActivity", "ProfileBadges", "ProfileSchedule",
    "ProfileFollowing", "ProfileNotes", "ProfileDownloads", "ProfileTeams",
  ],
  Player: [
    "PlayerQueue", "PlayerTranscript", "PlayerChapters", "PlayerRelated", "PlayerNotes",
    "PlayerSpeed", "PlayerCaptions", "PlayerSleepTimer", "PlayerAirplay",
  ],
  Settings: [
    "SettingsAppearance", "SettingsNotifications", "SettingsPrivacy", "SettingsAbout",
    "SettingsStorage", "SettingsAccount", "SettingsPlayback", "SettingsDeveloper",
  ],
  Login: ["LoginBenefits", "LoginFooter", "LoginTerms", "LoginSSO"],
};

const write = async (dir, name, contents) => {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}.swift`), contents, "utf8");
};

// Start clean so removing a name from the lists above actually deletes the file.
await fs.rm(coreComponents, { recursive: true, force: true });
await fs.rm(coreServices, { recursive: true, force: true });
for (const feature of Object.keys(FEATURES)) {
  await fs.rm(path.join(root, "app/RockyFeed/Features", feature, "Components"), {
    recursive: true,
    force: true,
  });
}

for (const [i, name] of COMPONENTS.entries()) await write(coreComponents, name, component(name, i));
for (const [i, name] of SERVICES.entries()) await write(coreServices, name, service(name, i));
for (const [feature, views] of Object.entries(FEATURES)) {
  const dir = path.join(root, "app/RockyFeed/Features", feature, "Components");
  for (const [i, name] of views.entries()) await write(dir, name, featureView(name, i));
}

const featureCount = Object.values(FEATURES).flat().length;
console.log(`Generated ${COMPONENTS.length + SERVICES.length + featureCount} Swift files.`);
console.log(`  Core components: ${COMPONENTS.length}`);
console.log(`  Core services:   ${SERVICES.length}`);
console.log(`  Feature views:   ${featureCount}`);

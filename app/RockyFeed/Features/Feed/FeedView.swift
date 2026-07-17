import DesignSystem
import Domain
import Models
import SwiftUI

public struct FeedView: View {
    @Environment(UserSession.self) private var session
    @State private var items: [FeedItem] = []
    @State private var isLoading = true

    private let service: any FeedServiceProtocol = FeedService()

    public init() {}

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(items) { item in
                        FeedRow(item: item)
                            .listRowInsets(EdgeInsets(
                                top: Theme.Spacing.sm,
                                leading: Theme.Spacing.md,
                                bottom: Theme.Spacing.sm,
                                trailing: Theme.Spacing.md
                            ))
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Feed")
            .task { await load() }
        }
    }

    private func load() async {
        isLoading = true
        let loaded = (try? await service.loadFeed()) ?? []
        let snapshot = UserSessionSnapshot(bookmarks: Set(session.currentUser?.bookmarks ?? []))
        items = RelevanceScoring.rank(loaded, session: snapshot)
        isLoading = false
    }
}

struct FeedRow: View {
    let item: FeedItem

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(spacing: Theme.Spacing.sm) {
                Badge(item.talk.track.displayName)
                Text(Formatters.time(item.talk.startsAt))
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
                Text(Formatters.duration(item.talk.durationMinutes))
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
            }

            Text(item.talk.title)
                .font(Theme.font(.headline))

            Text(item.talk.abstract)
                .font(Theme.font(.subheadline))
                .foregroundStyle(Theme.color(.labelSecondary))
                .lineLimit(2)

            HStack(spacing: Theme.Spacing.sm) {
                Text(item.talk.speaker.name)
                    .font(Theme.font(.caption, weight: .medium))
                Spacer()
                Label(Formatters.compactCount(item.likeCount), systemImage: "heart")
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
            }
        }
        .padding(.vertical, Theme.Spacing.xs)
    }
}

import CoreDesignSystem
import CoreDomain
import CoreImages
import CoreModels
import SwiftUI

public struct ProfileView: View {
    @Environment(UserSession.self) private var session

    private var bookmarkedTalks: [Talk] {
        let ids = Set(session.currentUser?.bookmarks ?? [])
        return TalkFixtures.talks.filter { ids.contains($0.id) }
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: Theme.Spacing.md) {
                        RemoteImage(url: nil, cornerRadius: Theme.Radius.lg)
                            .frame(width: 56, height: 56)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.currentUser?.name ?? "Guest")
                                .font(Theme.font(.headline))
                            Text(session.currentUser?.email ?? "")
                                .font(Theme.font(.caption))
                                .foregroundStyle(Theme.color(.labelSecondary))
                        }
                    }
                    .padding(.vertical, Theme.Spacing.xs)
                }

                Section("Bookmarks") {
                    if bookmarkedTalks.isEmpty {
                        Text("Nothing bookmarked yet.")
                            .font(Theme.font(.subheadline))
                            .foregroundStyle(Theme.color(.labelTertiary))
                    } else {
                        ForEach(bookmarkedTalks) { talk in
                            Text(talk.title)
                                .font(Theme.font(.subheadline))
                        }
                    }
                }
            }
            .navigationTitle("Profile")
        }
    }
}

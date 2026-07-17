import CoreDesignSystem
import CoreDomain
import CoreImages
import CoreModels
import SwiftUI

public struct PlayerView: View {
    @Environment(UserSession.self) private var session
    @State private var isPlaying = false
    @State private var progress: Double = 0.35

    private var talk: Talk { TalkFixtures.talks[0] }

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: Theme.Spacing.lg) {
                RemoteImage(url: nil, cornerRadius: Theme.Radius.lg)
                    .frame(height: 220)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Theme.Spacing.lg)

                VStack(spacing: Theme.Spacing.xs) {
                    Text(talk.title)
                        .font(Theme.font(.title3, weight: .semibold))
                        .multilineTextAlignment(.center)
                    Text(talk.speaker.name)
                        .font(Theme.font(.subheadline))
                        .foregroundStyle(Theme.color(.labelSecondary))
                }
                .padding(.horizontal, Theme.Spacing.lg)

                VStack(spacing: Theme.Spacing.xs) {
                    ProgressView(value: progress)
                        .tint(Theme.color(.accent))
                    HStack {
                        Text(Formatters.duration(Int(Double(talk.durationMinutes) * progress)))
                        Spacer()
                        Text(Formatters.duration(talk.durationMinutes))
                    }
                    .font(Theme.font(.caption))
                    .foregroundStyle(Theme.color(.labelTertiary))
                }
                .padding(.horizontal, Theme.Spacing.lg)

                HStack(spacing: Theme.Spacing.xl) {
                    Button {
                        progress = max(0, progress - 0.1)
                    } label: {
                        Image(systemName: "gobackward.15").font(.title2)
                    }

                    Button {
                        isPlaying.toggle()
                    } label: {
                        Image(systemName: isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 56))
                            .foregroundStyle(Theme.color(.accent))
                    }

                    Button {
                        progress = min(1, progress + 0.1)
                    } label: {
                        Image(systemName: "goforward.15").font(.title2)
                    }
                }

                Button {
                    session.toggleBookmark(talk.id)
                } label: {
                    Label(
                        session.isBookmarked(talk.id) ? "Bookmarked" : "Bookmark",
                        systemImage: session.isBookmarked(talk.id) ? "bookmark.fill" : "bookmark"
                    )
                }

                Spacer()
            }
            .padding(.top, Theme.Spacing.lg)
            .navigationTitle("Now Playing")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

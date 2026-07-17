import DesignSystem
import Domain
import Models
import SwiftUI

struct LoginRegions: View {
    let items: [FeedItem]

    private var totalMinutes: Int {
        items.reduce(0) { $0 + $1.talk.durationMinutes }
    }

    private var emphasis: Double {
        let base = Double(items.count) * 0.05
            + (items.contains { $0.isBookmarked } ? 0.3 : 0.1)
            + (totalMinutes > 90 ? 0.25 : 0.1)
            + Double(1) * 0.05
        return min(1.0, base)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(spacing: Theme.Spacing.xs) {
                Text("Login Regions")
                    .font(Theme.font(.headline))
                    .foregroundStyle(Theme.color(.labelPrimary))
                Spacer(minLength: 0)
                Badge(Formatters.compactCount(items.count), token: .destructive)
            }

            ForEach(items.prefix(3)) { item in
                SessionCard(
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

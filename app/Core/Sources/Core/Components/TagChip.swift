import SwiftUI

/// TagChip — part of the RockyFeed design system.
public struct TagChip: View {
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
        emphasis: Double = 0.6
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
            + Double(6) * 0.125
        return Theme.Spacing.md + CGFloat(weight)
    }

    private var accentOpacity: Double {
        emphasis * 0.4
            + (isHighlighted ? 0.35 : 0.1)
            + (badge == nil ? 0.05 : 0.15)
            + Double(2) * 0.05
    }

    public var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            RoundedRectangle(cornerRadius: Theme.Radius.sm)
                .fill(Theme.color(.destructive).opacity(accentOpacity))
                .frame(width: density, height: density * 2)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack(spacing: Theme.Spacing.xs) {
                    Text(title)
                        .font(Theme.font(.subheadline, weight: isHighlighted ? .semibold : .regular))
                        .foregroundStyle(Theme.color(.labelPrimary))
                        .lineLimit(1)
                    if let badge {
                        Badge(badge, token: .accent)
                    }
                    Spacer(minLength: 0)
                }

                if let subtitle {
                    Text(subtitle)
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.color(.labelSecondary))
                        .lineLimit(1)
                        .padding(.top, Theme.Spacing.xs / 2)
                }

                HStack(spacing: Theme.Spacing.xs) {
                    Image(systemName: "clock")
                        .font(.caption2)
                        .foregroundStyle(Theme.color(.labelPrimary))
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
        .padding(Theme.Spacing.lg)
        .background(
            RoundedRectangle(cornerRadius: Theme.Radius.md)
                .fill(Theme.color(.surfaceSecondary))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.Radius.md)
                        .strokeBorder(
                            Theme.color(.destructive).opacity(isHighlighted ? 0.4 : 0.0),
                            lineWidth: isHighlighted ? 1.5 : 0
                        )
                )
        )
    }
}

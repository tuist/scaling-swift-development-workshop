import SwiftUI
import UIKit

// The design system. Every view in every feature reaches for these tokens, which
// is exactly why a one-line tweak here rebuilds the entire app.

public enum ColorToken: String, CaseIterable, Sendable {
    case accent
    case accentMuted
    case surfacePrimary
    case surfaceSecondary
    case surfaceTertiary
    case labelPrimary
    case labelSecondary
    case labelTertiary
    case success
    case warning
    case destructive
}

public enum Theme {
    public static func color(_ token: ColorToken) -> Color {
        switch token {
        case .accent: return Color(red: 0.44, green: 0.24, blue: 0.99)
        case .accentMuted: return Color(red: 0.44, green: 0.24, blue: 0.99).opacity(0.12)
        case .surfacePrimary: return Color(.systemBackground)
        case .surfaceSecondary: return Color(.secondarySystemBackground)
        case .surfaceTertiary: return Color(.tertiarySystemBackground)
        case .labelPrimary: return Color(.label)
        case .labelSecondary: return Color(.secondaryLabel)
        case .labelTertiary: return Color(.tertiaryLabel)
        case .success: return Color(red: 0.13, green: 0.66, blue: 0.42)
        case .warning: return Color(red: 0.91, green: 0.62, blue: 0.14)
        case .destructive: return Color(red: 0.86, green: 0.24, blue: 0.29)
        }
    }

    public enum Spacing {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 24
        public static let xl: CGFloat = 32
    }

    public enum Radius {
        public static let sm: CGFloat = 6
        public static let md: CGFloat = 10
        public static let lg: CGFloat = 16
    }

    public static func font(_ style: Font.TextStyle, weight: Font.Weight = .regular) -> Font {
        .system(style, design: .default).weight(weight)
    }
}

public struct Badge: View {
    private let text: String
    private let token: ColorToken

    public init(_ text: String, token: ColorToken = .accent) {
        self.text = text
        self.token = token
    }

    public var body: some View {
        Text(text)
            .font(Theme.font(.caption2, weight: .semibold))
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)
            .background(Theme.color(token).opacity(0.14))
            .foregroundStyle(Theme.color(token))
            .clipShape(Capsule())
    }
}

public struct PrimaryButton: View {
    private let title: String
    private let action: () -> Void

    public init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(Theme.font(.body, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, Theme.Spacing.md)
                .background(Theme.color(.accent))
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.md))
        }
    }
}

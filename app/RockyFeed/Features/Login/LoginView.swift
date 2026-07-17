import DesignSystem
import Domain
import Models
import SwiftUI

public struct LoginView: View {
    @Environment(UserSession.self) private var session
    @State private var name: String = ""
    @State private var email: String = ""

    private var canSignIn: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && email.contains("@")
    }

    public init() {}

    public var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()

            VStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "mountain.2.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Theme.color(.accent))
                Text("RockyFeed")
                    .font(Theme.font(.largeTitle, weight: .bold))
                Text("Your companion for Swift Rockies")
                    .font(Theme.font(.subheadline))
                    .foregroundStyle(Theme.color(.labelSecondary))
            }

            VStack(spacing: Theme.Spacing.md) {
                TextField("Name", text: $name)
                    .textContentType(.name)
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
            }
            .textFieldStyle(.roundedBorder)

            PrimaryButton("Sign in") {
                session.signIn(email: email, name: name)
            }
            .disabled(!canSignIn)
            .opacity(canSignIn ? 1 : 0.5)

            Spacer()
        }
        .padding(Theme.Spacing.lg)
        .background(Theme.color(.surfacePrimary))
    }
}

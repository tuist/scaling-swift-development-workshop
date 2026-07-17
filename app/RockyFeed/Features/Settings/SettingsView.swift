import DesignSystem
import Domain
import Models
import SwiftUI

public struct SettingsView: View {
    @Environment(UserSession.self) private var session
    @State private var prefersReducedMotion = false
    @State private var notificationsEnabled = true

    public init() {}

    public var body: some View {
        NavigationStack {
            Form {
                Section("Appearance") {
                    Toggle("Reduce motion", isOn: $prefersReducedMotion)
                }

                Section("Notifications") {
                    Toggle("Talk reminders", isOn: $notificationsEnabled)
                }

                Section {
                    Button("Sign out", role: .destructive) {
                        session.signOut()
                    }
                }

                Section("About") {
                    LabeledContent("Version", value: BuildInfo.version)
                    LabeledContent("Build", value: BuildInfo.build)
                }
            }
            .navigationTitle("Settings")
        }
    }
}

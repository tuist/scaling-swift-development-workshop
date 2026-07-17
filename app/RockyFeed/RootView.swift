import CoreDesignSystem
import CoreDomain
import FeatureFeed
import FeatureLogin
import FeaturePlayer
import FeatureProfile
import FeatureSearch
import FeatureSettings
import SwiftUI

// Every feature is a folder in this one app target. There are no module
// boundaries — just directories. Nothing stops Settings from reaching into
// Player, and nothing can be built or tested in isolation.
struct RootView: View {
    @Environment(UserSession.self) private var session

    var body: some View {
        if session.isAuthenticated {
            TabView {
                FeedView()
                    .tabItem { Label("Feed", systemImage: "list.bullet.rectangle") }
                SearchView()
                    .tabItem { Label("Search", systemImage: "magnifyingglass") }
                PlayerView()
                    .tabItem { Label("Now Playing", systemImage: "play.circle") }
                ProfileView()
                    .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape") }
            }
            .tint(Theme.color(.accent))
        } else {
            LoginView()
        }
    }
}

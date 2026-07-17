import CoreDesignSystem
import CoreDomain
import FeatureFeed
import FeatureLogin
import FeaturePlayer
import FeatureProfile
import FeatureSearch
import FeatureSettings
import SwiftUI

@main
struct RockyFeedApp: App {
    @State private var session = UserSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
        }
    }
}

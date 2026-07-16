import Core
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

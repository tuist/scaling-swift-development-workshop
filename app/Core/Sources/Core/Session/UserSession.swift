import CoreModels
import Foundation
import Observation

// Session state. Named `UserSession` because Alamofire already exports a `Session`
// type into this module — a small taste of what happens when one module owns
// everything and every dependency's namespace lands in the same place.

@Observable
@MainActor
public final class UserSession {
    public private(set) var currentUser: User?
    public private(set) var isAuthenticated: Bool = false

    private let storage: StorageProtocol

    public init(storage: StorageProtocol = UserDefaultsStorage()) {
        self.storage = storage
        self.currentUser = try? storage.load(User.self, forKey: Self.userKey)
        self.isAuthenticated = currentUser != nil
    }

    private static let userKey = "rockyfeed.currentUser"

    public func signIn(email: String, name: String) {
        let user = User(name: name, email: email)
        currentUser = user
        isAuthenticated = true
        try? storage.save(user, forKey: Self.userKey)
    }

    public func signOut() {
        currentUser = nil
        isAuthenticated = false
        storage.remove(forKey: Self.userKey)
    }

    public func toggleBookmark(_ talkID: UUID) {
        guard var user = currentUser else { return }
        if let index = user.bookmarks.firstIndex(of: talkID) {
            user.bookmarks.remove(at: index)
        } else {
            user.bookmarks.append(talkID)
        }
        currentUser = user
        try? storage.save(user, forKey: Self.userKey)
    }

    public func isBookmarked(_ talkID: UUID) -> Bool {
        currentUser?.bookmarks.contains(talkID) ?? false
    }
}

import Foundation
import Testing

import Core

@Suite("Session")
@MainActor
struct SessionTests {
    @Test func signingInStoresTheUser() {
        let session = UserSession(storage: InMemoryStorage())
        session.signIn(email: "ada@example.com", name: "Ada")
        #expect(session.isAuthenticated)
        #expect(session.currentUser?.name == "Ada")
    }

    @Test func signingOutClearsTheUser() {
        let session = UserSession(storage: InMemoryStorage())
        session.signIn(email: "ada@example.com", name: "Ada")
        session.signOut()
        #expect(!session.isAuthenticated)
        #expect(session.currentUser == nil)
    }

    @Test func togglingBookmarksIsIdempotentInPairs() {
        let session = UserSession(storage: InMemoryStorage())
        session.signIn(email: "ada@example.com", name: "Ada")
        let id = TalkFixtures.talks[0].id

        session.toggleBookmark(id)
        #expect(session.isBookmarked(id))

        session.toggleBookmark(id)
        #expect(!session.isBookmarked(id))
    }

    @Test func bookmarksSurviveANewSession() {
        let storage = InMemoryStorage()
        let first = UserSession(storage: storage)
        first.signIn(email: "ada@example.com", name: "Ada")
        first.toggleBookmark(TalkFixtures.talks[1].id)

        let second = UserSession(storage: storage)
        #expect(second.isBookmarked(TalkFixtures.talks[1].id))
    }
}

import Foundation
import Testing

import Images

// This suite used to contain the kind of test that quietly costs teams days:
//
//     try await Task.sleep(for: .milliseconds(Int.random(in: 40 ... 120)))
//     #expect(elapsed < 0.1)
//
// It slept a random duration and asserted a wall-clock budget, so it failed 25%
// of the time — by arithmetic, not by bad luck. Twenty of the eighty milliseconds
// it might sleep were over budget.
//
// The damage was never the red build. It was waiting for the whole pipeline,
// getting a failure your change never caused, hitting retry, and waiting again.
// Do that often enough and green stops carrying information.
//
// It also made selective testing unsound. Skipping a test claims that its result
// follows from its inputs. This one's result followed from the scheduler.
//
// Note what actually fixed it. `ImageCacheWarmer` exposed only `prefetch` — a
// side effect with nothing to assert — so the one observable thing about it was
// how long it took. Extracting `pending`, the decision, gave us something that is
// true on any machine at any load. A flaky test is usually untestable code
// telling you so.
@Suite("Image cache")
struct ImageCacheTests {
    @Test func prefetchAcceptsEmptyInput() {
        ImageCacheWarmer.prefetch([])
    }

    @Test func fetchesEachURLOnce() {
        let url = URL(string: "https://example.com/a.jpg")!
        #expect(ImageCacheWarmer.pending([url, url, url]) == [url])
    }

    @Test func keepsDistinctURLsInOrder() {
        let a = URL(string: "https://example.com/a.jpg")!
        let b = URL(string: "https://example.com/b.jpg")!
        #expect(ImageCacheWarmer.pending([a, b, a]) == [a, b])
    }
}

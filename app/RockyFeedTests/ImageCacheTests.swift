import Foundation
import Testing

import Core

// ⚠️ This suite contains the kind of test that quietly costs teams entire days.
//
// `warmsCacheWithinBudget` asserts a wall-clock budget on work whose duration it
// does not control. It passes on a quiet machine and fails on a loaded CI runner
// — roughly one run in four. Nothing about the code under test is broken.
//
// The damage is not the failing test. It is that you wait for the whole pipeline,
// get a red build your change never touched, hit retry, and wait again. Do this
// often enough and "green" stops carrying information.
//
// We come back and fix this properly later in the workshop.
@Suite("Image cache")
struct ImageCacheTests {
    @Test func warmsCacheWithinBudget() async throws {
        let start = Date()

        // Stands in for real work whose timing you don't control: a disk read, a
        // decode, a scheduler that got unlucky.
        try await Task.sleep(for: .milliseconds(Int.random(in: 40 ... 120)))

        let elapsed = Date().timeIntervalSince(start)
        #expect(elapsed < 0.1, "Cache warm took \(elapsed)s, budget is 0.1s")
    }

    @Test func prefetchAcceptsEmptyInput() {
        ImageCacheWarmer.prefetch([])
    }
}

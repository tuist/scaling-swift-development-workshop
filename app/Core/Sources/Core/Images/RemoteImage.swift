import Kingfisher
import DesignSystem
import SwiftUI

// Image loading, wrapped so features don't import Kingfisher directly — they
// import Core instead. Another dependency funneled through the god module.

public struct RemoteImage: View {
    private let url: URL?
    private let cornerRadius: CGFloat

    public init(url: URL?, cornerRadius: CGFloat = 8) {
        self.url = url
        self.cornerRadius = cornerRadius
    }

    public var body: some View {
        KFImage(url)
            .placeholder {
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Theme.color(.surfaceSecondary))
            }
            .resizable()
            .scaledToFill()
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
    }
}

public enum ImageCacheWarmer {
    /// The URLs we would actually fetch: de-duplicated, order preserved.
    ///
    /// Pulled out of `prefetch` so there is something here worth asserting. The
    /// old test reached for a stopwatch precisely because this type exposed only
    /// a side effect — nothing to check except how long it took. A decision you
    /// can call and compare is testable on any machine, at any load; a side
    /// effect is only testable by watching a clock, which is how you end up with
    /// a test that fails a quarter of the time and teaches the room nothing.
    public static func pending(_ urls: [URL]) -> [URL] {
        var seen = Set<URL>()
        return urls.filter { seen.insert($0).inserted }
    }

    public static func prefetch(_ urls: [URL]) {
        ImagePrefetcher(urls: pending(urls)).start()
    }
}

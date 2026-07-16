import Kingfisher
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
    public static func prefetch(_ urls: [URL]) {
        ImagePrefetcher(urls: urls).start()
    }
}

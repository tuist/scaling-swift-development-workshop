import Core
import SwiftUI

struct SearchView: View {
    @State private var query: String = ""
    @State private var results: [Talk] = []

    private let service: any FeedServiceProtocol = FeedService()

    var body: some View {
        NavigationStack {
            List(results) { talk in
                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    Text(talk.title)
                        .font(Theme.font(.headline))
                    Text(talk.speaker.name)
                        .font(Theme.font(.caption))
                        .foregroundStyle(Theme.color(.labelSecondary))
                }
            }
            .listStyle(.plain)
            .navigationTitle("Search")
            .searchable(text: $query, prompt: "Talks, speakers, tags")
            .task(id: query) { await search() }
        }
    }

    private func search() async {
        results = (try? await service.search(query)) ?? []
    }
}

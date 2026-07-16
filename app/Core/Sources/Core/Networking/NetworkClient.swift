import Alamofire
import Foundation

// A thin wrapper around Alamofire. Because it lives in Core, *every* feature that
// needs the network pulls Alamofire in through Core — and a clean build has to
// resolve and compile Alamofire before almost anything else can start.

public protocol NetworkClientProtocol: Sendable {
    func get<T: Decodable & Sendable>(_ path: String, as type: T.Type) async throws -> T
}

public struct NetworkClient: NetworkClientProtocol {
    public let baseURL: URL
    private let session: Session

    public init(baseURL: URL = URL(string: "https://api.swiftrockies.example")!) {
        self.baseURL = baseURL
        self.session = Session.default
    }

    public func get<T: Decodable & Sendable>(_ path: String, as type: T.Type) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        let request = session.request(url, method: .get)
        return try await request
            .validate()
            .serializingDecodable(T.self)
            .value
    }
}

// In-memory client used by the app and previews so the workshop doesn't need a
// live backend. The Alamofire-backed client above still gets compiled and linked.
public struct StubNetworkClient: NetworkClientProtocol {
    public init() {}

    public func get<T: Decodable & Sendable>(_ path: String, as type: T.Type) async throws -> T {
        throw NetworkError.notImplemented
    }

    public enum NetworkError: Error {
        case notImplemented
    }
}

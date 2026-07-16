import Foundation

// Persistence. Also in Core, of course.

public protocol StorageProtocol: Sendable {
    func save<T: Encodable>(_ value: T, forKey key: String) throws
    func load<T: Decodable>(_ type: T.Type, forKey key: String) throws -> T?
    func remove(forKey key: String)
}

// `UserDefaults` is thread-safe but not `Sendable`, so this is a final class with
// an unchecked conformance rather than a struct.
public final class UserDefaultsStorage: StorageProtocol, @unchecked Sendable {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func save<T: Encodable>(_ value: T, forKey key: String) throws {
        let data = try JSONEncoder().encode(value)
        defaults.set(data, forKey: key)
    }

    public func load<T: Decodable>(_ type: T.Type, forKey key: String) throws -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try JSONDecoder().decode(type, from: data)
    }

    public func remove(forKey key: String) {
        defaults.removeObject(forKey: key)
    }
}

public final class InMemoryStorage: StorageProtocol, @unchecked Sendable {
    private var values: [String: Data] = [:]
    private let lock = NSLock()

    public init() {}

    public func save<T: Encodable>(_ value: T, forKey key: String) throws {
        let data = try JSONEncoder().encode(value)
        lock.lock()
        defer { lock.unlock() }
        values[key] = data
    }

    public func load<T: Decodable>(_ type: T.Type, forKey key: String) throws -> T? {
        lock.lock()
        defer { lock.unlock() }
        guard let data = values[key] else { return nil }
        return try JSONDecoder().decode(type, from: data)
    }

    public func remove(forKey key: String) {
        lock.lock()
        defer { lock.unlock() }
        values.removeValue(forKey: key)
    }
}

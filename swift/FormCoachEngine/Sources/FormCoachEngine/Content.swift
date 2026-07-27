import Foundation

public enum ContentLoader {
    public static func load(from url: URL) throws -> ContentPack {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(ContentPack.self, from: data)
    }
}

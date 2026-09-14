import Foundation

public enum CoachChoiceRequestError: Error, Equatable, Sendable {
    case invalidFields, invalidRequest, oversized
}

/// The HTML engine's trusted `coach-choice/1` request. Validation establishes
/// structure and bounds, not provenance, truthful claims or absence of personal
/// data. Only the caller supplies approved options; a model cannot author them.
/// This is not a public report/diagnostic importer and exposes no action executor.
public struct CoachChoiceRequest: Codable, Equatable, Sendable {
    public static let maximumEncodedBytes = 24 * 1024
    public enum Purpose: String, Codable, Sendable, CaseIterable {
        case explanation, plan, review
    }

    public let schema: String
    public let requestId: String
    public let purpose: Purpose
    public let query: String
    public let options: [Option]
    public let defaultIds: [String]
    public let limit: Int

    public struct Option: Codable, Equatable, Sendable {
        public let id: String
        public let title: String
        public let text: String

        public init(id: String, title: String, text: String) throws {
            guard choiceIdentifier(id), choiceText(title, maximumLength: 100),
                  choiceText(text, maximumLength: 600) else {
                throw CoachChoiceRequestError.invalidRequest
            }
            self.id = id
            self.title = title
            self.text = text
        }

        private enum CodingKeys: String, CodingKey, CaseIterable { case id, title, text }
        public init(from decoder: Decoder) throws {
            try requireChoiceKeys(decoder, CodingKeys.allCases.map(\.rawValue))
            let c = try decoder.container(keyedBy: CodingKeys.self)
            try self.init(id: c.decode(String.self, forKey: .id),
                          title: c.decode(String.self, forKey: .title),
                          text: c.decode(String.self, forKey: .text))
        }
    }

    public init(schema: String = "coach-choice/1", requestId: String, purpose: Purpose,
                query: String, options: [Option], defaultIds: [String], limit: Int) throws {
        let ids = Set(options.map(\.id)) // IDs are ASCII, with no Unicode normalization ambiguity.
        guard schema == "coach-choice/1", choiceIdentifier(requestId), query.utf16.count <= 500,
              (1...2).contains(limit), options.count <= 24, ids.count == options.count,
              defaultIds.count <= limit, Set(defaultIds).count == defaultIds.count,
              defaultIds.allSatisfy(ids.contains), options.isEmpty == defaultIds.isEmpty else {
            throw CoachChoiceRequestError.invalidRequest
        }
        self.schema = schema
        self.requestId = requestId
        self.purpose = purpose
        self.query = query
        self.options = options
        self.defaultIds = defaultIds
        self.limit = limit
        // Match UTF-8 JSON.stringify size, including escaped controls and quotes.
        // Whitespace-only query is allowed; original text is never trimmed/rewritten.
        guard try encodedJSON().count <= Self.maximumEncodedBytes else {
            throw CoachChoiceRequestError.oversized
        }
    }

    /// Bytes from a trusted engine caller, not an arbitrary external import.
    /// The transport cap runs before decoding; init also bounds compact JSON size.
    public static func decodeTrustedEngineJSON(_ data: Data) throws -> Self {
        guard data.count <= maximumEncodedBytes else { throw CoachChoiceRequestError.oversized }
        return try JSONDecoder().decode(Self.self, from: data)
    }

    public func encodedJSON() throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        return try encoder.encode(self)
    }

    public func option(id: String) -> Option? { options.first { $0.id == id } }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case schema, requestId, purpose, query, options, defaultIds, limit
    }
    public init(from decoder: Decoder) throws {
        try requireChoiceKeys(decoder, CodingKeys.allCases.map(\.rawValue))
        let c = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(schema: c.decode(String.self, forKey: .schema),
                      requestId: c.decode(String.self, forKey: .requestId),
                      purpose: c.decode(Purpose.self, forKey: .purpose),
                      query: c.decode(String.self, forKey: .query),
                      options: c.decode([Option].self, forKey: .options),
                      defaultIds: c.decode([String].self, forKey: .defaultIds),
                      limit: c.decode(Int.self, forKey: .limit))
    }
}

/// JSON-value parity entry point for the HTML validator. No engine policy lives here.
public func validateCoachChoiceRequest(_ data: Data) -> Bool {
    do { _ = try CoachChoiceRequest.decodeTrustedEngineJSON(data); return true }
    catch { return false }
}

private func choiceIdentifier(_ value: String) -> Bool {
    (1...80).contains(value.utf8.count) && value.utf8.allSatisfy {
        (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45
    }
}

private func choiceText(_ value: String, maximumLength: Int) -> Bool {
    // ECMAScript trim includes BOM and excludes e.g. U+0085; Foundation's
    // whitespacesAndNewlines differs. Lengths count UTF-16 code units, as in JS.
    let jsWhitespace = CharacterSet(charactersIn:
        "\u{0009}\u{000a}\u{000b}\u{000c}\u{000d}\u{0020}\u{00a0}\u{1680}" +
        "\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}" +
        "\u{2008}\u{2009}\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}")
    return value.utf16.count <= maximumLength && !value.trimmingCharacters(in: jsWhitespace).isEmpty
}

private struct ChoiceJSONKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

func requireChoiceKeys(_ decoder: Decoder, _ keys: [String]) throws {
    let c = try decoder.container(keyedBy: ChoiceJSONKey.self)
    guard Set(c.allKeys.map(\.stringValue)) == Set(keys) else {
        throw CoachChoiceRequestError.invalidFields
    }
}

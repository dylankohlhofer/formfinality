import Foundation

public enum SummaryEnvelopeError: Error, Equatable, Sendable {
    case invalidFields, unsupportedSchema, invalidText, tooManyCards, duplicateIDs
    case invalidDefaults, oversized
}

/// Trusted, engine-authored `buildWorkoutSummary` output, NOT an arbitrary import
/// format. Validation checks structure and bounds, not whether a claim is true or
/// whether text contains personal data. Only the engine may author these strings.
/// This component never computes workout facts or changes the workout record.
public struct WorkoutSummaryEnvelope: Codable, Equatable, Sendable {
    public static let maximumEncodedBytes = 64 * 1024
    public static let maximumTextBytes = 16 * 1024
    public static let maximumCards = 24

    public let schema: String
    public let headline: String
    public let coverage: String
    public let cards: [Card]
    public let defaultCardIds: [String]

    public struct Card: Codable, Equatable, Sendable {
        public enum Kind: String, Codable, Sendable { case observation, tempo, recorded }
        public let id: String
        public let movement: String
        public let kind: Kind
        public let text: String
        public let tip: String?

        public init(id: String, movement: String, kind: Kind, text: String, tip: String? = nil) throws {
            try validateText(id, maximumBytes: 64)
            try validateText(movement, maximumBytes: 256)
            try validateText(text, maximumBytes: 1024)
            if let tip { try validateText(tip, maximumBytes: 1024) }
            self.id = id
            self.movement = movement
            self.kind = kind
            self.text = text
            self.tip = tip
        }

        private enum CodingKeys: String, CodingKey, CaseIterable { case id, movement, kind, text, tip }

        public init(from decoder: Decoder) throws {
            try requireKeys(decoder, CodingKeys.allCases.map(\.rawValue))
            let c = try decoder.container(keyedBy: CodingKeys.self)
            try self.init(id: c.decode(String.self, forKey: .id),
                          movement: c.decode(String.self, forKey: .movement),
                          kind: c.decode(Kind.self, forKey: .kind),
                          text: c.decode(String.self, forKey: .text),
                          tip: c.decodeIfPresent(String.self, forKey: .tip))
        }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(id, forKey: .id)
            try c.encode(movement, forKey: .movement)
            try c.encode(kind, forKey: .kind)
            try c.encode(text, forKey: .text)
            // The contract includes an explicit null, including on a round trip.
            try c.encode(tip, forKey: .tip)
        }
    }

    public init(schema: String = "workout-summary/1", headline: String, coverage: String,
                cards: [Card], defaultCardIds: [String]) throws {
        guard schema == "workout-summary/1" else { throw SummaryEnvelopeError.unsupportedSchema }
        try validateText(headline, maximumBytes: 4096)
        try validateText(coverage, maximumBytes: 2048)
        guard cards.count <= Self.maximumCards else { throw SummaryEnvelopeError.tooManyCards }
        // UTF-8 identity deliberately matches JS string identity, without Swift's
        // canonical Unicode equivalence merging two differently spelled IDs.
        let catalog = Set(cards.map { Data($0.id.utf8) })
        guard catalog.count == cards.count else { throw SummaryEnvelopeError.duplicateIDs }
        let defaults = defaultCardIds.map { Data($0.utf8) }
        guard defaults.count <= 2, Set(defaults).count == defaults.count,
              defaults.allSatisfy(catalog.contains), cards.isEmpty == defaults.isEmpty else {
            throw SummaryEnvelopeError.invalidDefaults
        }
        let total = headline.utf8.count + coverage.utf8.count + cards.reduce(0) {
            $0 + $1.id.utf8.count + $1.movement.utf8.count + $1.text.utf8.count + ($1.tip?.utf8.count ?? 0)
        }
        guard total <= Self.maximumTextBytes else { throw SummaryEnvelopeError.oversized }
        self.schema = schema
        self.headline = headline
        self.coverage = coverage
        self.cards = cards
        self.defaultCardIds = defaultCardIds
    }

    /// Use this entry point for serialized engine output: it caps bytes BEFORE
    /// decoding. Codable also validates fields, counts and total decoded text.
    public static func decodeTrustedEngineJSON(_ data: Data) throws -> Self {
        guard data.count <= maximumEncodedBytes else { throw SummaryEnvelopeError.oversized }
        return try JSONDecoder().decode(Self.self, from: data)
    }

    public func card(id: String) -> Card? {
        cards.first { $0.id.utf8.elementsEqual(id.utf8) }
    }

    private enum CodingKeys: String, CodingKey, CaseIterable {
        case schema, headline, coverage, cards, defaultCardIds
    }

    public init(from decoder: Decoder) throws {
        try requireKeys(decoder, CodingKeys.allCases.map(\.rawValue))
        let c = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(schema: c.decode(String.self, forKey: .schema),
                      headline: c.decode(String.self, forKey: .headline),
                      coverage: c.decode(String.self, forKey: .coverage),
                      cards: c.decode([Card].self, forKey: .cards),
                      defaultCardIds: c.decode([String].self, forKey: .defaultCardIds))
    }
}

private func validateText(_ value: String, maximumBytes: Int) throws {
    guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          !value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
        throw SummaryEnvelopeError.invalidText
    }
    guard value.utf8.count <= maximumBytes else { throw SummaryEnvelopeError.oversized }
}

struct SummaryJSONKey: CodingKey {
    let stringValue: String
    let intValue: Int? = nil
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

func requireKeys(_ decoder: Decoder, _ keys: [String]) throws {
    let container = try decoder.container(keyedBy: SummaryJSONKey.self)
    guard Set(container.allKeys.map(\.stringValue)) == Set(keys) else {
        throw SummaryEnvelopeError.invalidFields
    }
}

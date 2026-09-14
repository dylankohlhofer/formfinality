import Foundation

public struct SummarySelection: Codable, Equatable, Sendable {
    public enum Source: String, Codable, Sendable { case template, onDevice = "on-device" }
    public enum Reason: String, Codable, Sendable {
        case notRequested = "not-requested", invalidSelection = "invalid-selection", selected
    }
    public let source: Source
    public let reason: Reason
    public let cardIds: [String]
}

/// Mirrors HTML `selectSummaryCards` for JSON values. No JSON repair, stripping
/// extra fields, prose extraction or partial acceptance. nil/JSON null means the
/// JS default argument. A malformed or oversized wire response rejects as a whole.
public func selectSummaryCards(_ summary: WorkoutSummaryEnvelope, selection: Data? = nil) -> SummarySelection {
    func fallback(_ reason: SummarySelection.Reason) -> SummarySelection {
        SummarySelection(source: .template, reason: reason, cardIds: summary.defaultCardIds)
    }
    guard let selection else { return fallback(.notRequested) }
    guard selection.count <= 4096 else { return fallback(.invalidSelection) }
    var wire = SelectionWire(bytes: Array(selection))
    guard wire.isValid() else { return fallback(.invalidSelection) }
    do {
        let decoder = JSONDecoder()
        let response = try decoder.decode(SelectionResponse?.self, from: selection)
        guard let response else { return fallback(.notRequested) }
        let ids = response.cardIds
        guard (1...2).contains(ids.count), Set(ids.map { Data($0.utf8) }).count == ids.count,
              ids.allSatisfy({ summary.card(id: $0) != nil }) else {
            return fallback(.invalidSelection)
        }
        return SummarySelection(source: .onDevice, reason: .selected, cardIds: ids)
    } catch {
        return fallback(.invalidSelection)
    }
}

/// Fixed-depth wire grammar: null OR exactly { string: [string, optional-string] }.
/// JSONDecoder alone accepts trailing commas and duplicate keys on Apple platforms.
/// Check syntax before decoding, then let SelectionResponse check the decoded key
/// and strings. No generic JSON parser, repair, recursion or unbounded allocation.
private struct SelectionWire {
    let bytes: [UInt8]
    private var index = 0

    init(bytes: [UInt8]) { self.bytes = bytes }

    mutating func isValid() -> Bool {
        if take(0x6e) { // literal null; only the helper treats this as not-requested
            guard index + 3 <= bytes.count,
                  bytes[index..<(index + 3)].elementsEqual([0x75, 0x6c, 0x6c]) else { return false }
            index += 3
        } else {
            guard take(0x7b), string(), take(0x3a), take(0x5b), string() else { return false }
            if take(0x2c) { guard string() else { return false } }
            // Requiring the object to end here excludes all repeated/extra keys.
            guard take(0x5d), take(0x7d) else { return false }
        }
        whitespace()
        return index == bytes.count
    }

    private mutating func whitespace() {
        while index < bytes.count, [0x20, 0x09, 0x0a, 0x0d].contains(bytes[index]) { index += 1 }
    }

    private mutating func take(_ byte: UInt8) -> Bool {
        whitespace()
        guard index < bytes.count, bytes[index] == byte else { return false }
        index += 1
        return true
    }

    private mutating func string() -> Bool {
        guard take(0x22) else { return false }
        while index < bytes.count {
            let byte = bytes[index]
            index += 1
            if byte == 0x22 { return true }
            if byte < 0x20 { return false }
            if byte == 0x5c {
                guard index < bytes.count else { return false }
                let escape = bytes[index]
                index += 1
                if escape == 0x75 { // \uXXXX; JSONDecoder also validates UTF-8/surrogates.
                    guard index + 4 <= bytes.count else { return false }
                    for hex in bytes[index..<(index + 4)] {
                        guard (0x30...0x39).contains(hex) || (0x41...0x46).contains(hex) ||
                              (0x61...0x66).contains(hex) else { return false }
                    }
                    index += 4
                } else if ![0x22, 0x5c, 0x2f, 0x62, 0x66, 0x6e, 0x72, 0x74].contains(escape) {
                    return false
                }
            }
        }
        return false
    }
}

private struct SelectionResponse: Decodable {
    let cardIds: [String]
    private enum CodingKeys: String, CodingKey { case cardIds }
    init(from decoder: Decoder) throws {
        try requireKeys(decoder, ["cardIds"])
        cardIds = try decoder.container(keyedBy: CodingKeys.self).decode([String].self, forKey: .cardIds)
    }
}

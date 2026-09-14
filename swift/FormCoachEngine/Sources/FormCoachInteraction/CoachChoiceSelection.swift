import Foundation

public struct CoachChoiceSelection: Codable, Equatable, Sendable {
    public enum Source: String, Codable, Sendable { case template, onDevice = "on-device" }
    public enum Reason: String, Codable, Sendable {
        case notRequested = "not-requested", invalidRequest = "invalid-request"
        case noOptions = "no-options", invalidSelection = "invalid-selection", selected
    }
    public let choiceIds: [String]
    public let source: Source
    public let reason: Reason
}

/// Mirrors HTML selectCoachChoices for serialized trusted input, including an
/// invalid request. Rejection never substitutes options or changes constraints.
public func selectCoachChoices(_ requestJSON: Data, selection: Data? = nil) -> CoachChoiceSelection {
    do {
        return selectCoachChoices(try CoachChoiceRequest.decodeTrustedEngineJSON(requestJSON), selection: selection)
    } catch {
        return CoachChoiceSelection(choiceIds: [], source: .template, reason: .invalidRequest)
    }
}

/// Fixed choice policy from HTML. Whole-response validation; no repair, prose
/// extraction, partial acceptance or sorting. nil/JSON null means not requested
/// in the pure policy; the coordinator rejects null from a requested provider.
public func selectCoachChoices(_ request: CoachChoiceRequest, selection: Data? = nil) -> CoachChoiceSelection {
    func fallback(_ reason: CoachChoiceSelection.Reason) -> CoachChoiceSelection {
        CoachChoiceSelection(choiceIds: request.defaultIds, source: .template, reason: reason)
    }
    guard !request.options.isEmpty else { return fallback(.noOptions) }
    guard let selection else { return fallback(.notRequested) }
    guard selection.count <= 4096 else { return fallback(.invalidSelection) }
    var wire = ChoiceSelectionWire(bytes: Array(selection))
    guard wire.isValid() else { return fallback(.invalidSelection) }
    do {
        guard let response = try JSONDecoder().decode(ChoiceResponse?.self, from: selection) else {
            return fallback(.notRequested)
        }
        let ids = response.choiceIds
        guard (1...request.limit).contains(ids.count), Set(ids).count == ids.count,
              ids.allSatisfy({ request.option(id: $0) != nil }) else { return fallback(.invalidSelection) }
        return CoachChoiceSelection(choiceIds: ids, source: .onDevice, reason: .selected)
    } catch { return fallback(.invalidSelection) }
}

/// Adapted from FormCoachSummary's fixed-depth SelectionWire. JSONDecoder alone
/// accepts duplicate keys and trailing commas on Apple platforms. This grammar
/// permits null OR one object member containing one/two strings, nothing else.
private struct ChoiceSelectionWire {
    let bytes: [UInt8]
    private var index = 0
    init(bytes: [UInt8]) { self.bytes = bytes }

    mutating func isValid() -> Bool {
        if take(0x6e) {
            guard index + 3 <= bytes.count,
                  bytes[index..<(index + 3)].elementsEqual([0x75, 0x6c, 0x6c]) else { return false }
            index += 3
        } else {
            guard take(0x7b), string(), take(0x3a), take(0x5b), string() else { return false }
            if take(0x2c) { guard string() else { return false } }
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
                if escape == 0x75 {
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

private struct ChoiceResponse: Decodable {
    let choiceIds: [String]
    private enum CodingKeys: String, CodingKey { case choiceIds }
    init(from decoder: Decoder) throws {
        try requireChoiceKeys(decoder, ["choiceIds"])
        choiceIds = try decoder.container(keyedBy: CodingKeys.self).decode([String].self, forKey: .choiceIds)
    }
}

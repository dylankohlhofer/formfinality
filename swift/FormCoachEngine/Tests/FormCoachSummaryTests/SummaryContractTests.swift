import Foundation
import XCTest
@testable import FormCoachSummary

/// No bundled copy: JS, native tests and the opt-in smoke read the same file.
enum SummaryFixture {
    static var url: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("testing/summary-selection-vectors.json")
    }

    static func object() throws -> [String: Any] {
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        XCTAssertEqual(root["schema"] as? Int, 1)
        return root
    }

    static func summaryObject() throws -> [String: Any] {
        try XCTUnwrap(object()["summary"] as? [String: Any])
    }

    static func summary() throws -> WorkoutSummaryEnvelope {
        try WorkoutSummaryEnvelope.decodeTrustedEngineJSON(json(summaryObject()))
    }

    static func json(_ value: Any) throws -> Data {
        try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys])
    }
}

final class SummaryContractTests: XCTestCase {
    func testSharedJavaScriptSelectionVectors() throws {
        let root = try SummaryFixture.object()
        let summary = try SummaryFixture.summary()
        let cases = try XCTUnwrap(root["cases"] as? [[String: Any]])
        XCTAssertFalse(cases.isEmpty, "A missing/empty shared specification is a failure")
        for row in cases {
            let name = try XCTUnwrap(row["name"] as? String)
            let selection = try SummaryFixture.json(XCTUnwrap(row["selection"]))
            let expected = try JSONDecoder().decode(SummarySelection.self,
                from: SummaryFixture.json(XCTUnwrap(row["expected"])))
            XCTAssertEqual(selectSummaryCards(summary, selection: selection), expected, name)
        }
        print("Summary selection: \(cases.count) shared JS/Swift cases read from \(SummaryFixture.url.path)")
    }

    func testRoundTripKeepsEngineTextAndExplicitNullTips() throws {
        let summary = try SummaryFixture.summary()
        let encoded = try JSONEncoder().encode(summary)
        XCTAssertEqual(try WorkoutSummaryEnvelope.decodeTrustedEngineJSON(encoded), summary)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        let cards = try XCTUnwrap(object["cards"] as? [[String: Any]])
        for (index, card) in summary.cards.enumerated() where card.tip == nil {
            XCTAssertTrue(cards[index]["tip"] is NSNull)
        }
        XCTAssertEqual(selectSummaryCards(summary).cardIds, summary.defaultCardIds)
    }

    func testMalformedEnvelopeFieldsAreRejected() throws {
        let original = try SummaryFixture.summaryObject()
        var variants: [[String: Any]] = []
        for key in ["schema", "headline", "coverage", "cards", "defaultCardIds"] {
            var removed = original; removed.removeValue(forKey: key); variants.append(removed)
            var null = original; null[key] = NSNull(); variants.append(null)
        }
        for (key, value): (String, Any) in [
            ("schema", "workout-summary/2"), ("headline", " "), ("coverage", ""),
            ("headline", "line\u{0000}break"), ("cards", "not an array"),
            ("defaultCardIds", []), ("defaultCardIds", ["unknown"]),
            ("defaultCardIds", ["set-1-focus", "set-1-focus"]),
            ("defaultCardIds", ["set-1-focus", "set-1-work", "set-2-work"]),
            ("privateName", "not permitted at this boundary")
        ] {
            var changed = original; changed[key] = value; variants.append(changed)
        }
        let originalCards = try XCTUnwrap(original["cards"] as? [[String: Any]])
        for key in ["id", "movement", "kind", "text", "tip"] {
            var cards = originalCards; cards[0].removeValue(forKey: key)
            var changed = original; changed["cards"] = cards; variants.append(changed)
        }
        for (key, value): (String, Any) in [
            ("id", ""), ("movement", ""), ("text", ""), ("kind", "diagnosis"),
            ("tip", 42), ("tip", ""), ("text", true), ("joints", [1, 2, 3])
        ] {
            var cards = originalCards; cards[0][key] = value
            var changed = original; changed["cards"] = cards; variants.append(changed)
        }
        var duplicate = original; duplicate["cards"] = originalCards + [originalCards[0]]
        variants.append(duplicate)
        for (index, variant) in variants.enumerated() {
            let data = try SummaryFixture.json(variant)
            XCTAssertThrowsError(try WorkoutSummaryEnvelope.decodeTrustedEngineJSON(data), "Malformed variant \(index)")
            XCTAssertThrowsError(try JSONDecoder().decode(WorkoutSummaryEnvelope.self, from: data),
                                 "Direct Codable decoding must also validate variant \(index)")
        }
        for json in ["null", "false", "[]", "{}", "{", "{} trailing"] {
            XCTAssertThrowsError(try WorkoutSummaryEnvelope.decodeTrustedEngineJSON(Data(json.utf8)))
        }
    }

    func testEnvelopeBoundsAndEmptyCatalog() throws {
        let empty = try WorkoutSummaryEnvelope(headline: "No recorded sets.", coverage: "No judgement.",
                                              cards: [], defaultCardIds: [])
        XCTAssertEqual(selectSummaryCards(empty).cardIds, [])
        XCTAssertEqual(selectSummaryCards(empty, selection: Data(#"{"cardIds":["invented"]}"#.utf8)).reason,
                       .invalidSelection)
        let cards = try (1...24).map {
            try WorkoutSummaryEnvelope.Card(id: "set-\($0)-work", movement: "Plank", kind: .recorded,
                                            text: "The camera recorded 12 seconds of held time.")
        }
        XCTAssertNoThrow(try WorkoutSummaryEnvelope(headline: "Recorded work.", coverage: "Observed only.",
            cards: cards, defaultCardIds: [cards[0].id]))
        XCTAssertThrowsError(try WorkoutSummaryEnvelope(headline: "Recorded work.", coverage: "Observed only.",
            cards: cards + [cards[0]], defaultCardIds: [cards[0].id]))
        for (headline, coverage) in [(String(repeating: "a", count: 4097), "Coverage"),
                                     ("Headline", String(repeating: "a", count: 2049))] {
            XCTAssertThrowsError(try WorkoutSummaryEnvelope(headline: headline, coverage: coverage,
                                                            cards: [], defaultCardIds: []))
        }
        for (id, movement, text, tip) in [
            (String(repeating: "i", count: 65), "Plank", "Text", nil as String?),
            ("id", String(repeating: "m", count: 257), "Text", nil),
            ("id", "Plank", String(repeating: "é", count: 513), nil),
            ("id", "Plank", "Text", String(repeating: "t", count: 1025))
        ] {
            XCTAssertThrowsError(try WorkoutSummaryEnvelope.Card(id: id, movement: movement,
                                                                  kind: .recorded, text: text, tip: tip))
        }
        let largeCards = try (1...24).map {
            try WorkoutSummaryEnvelope.Card(id: "id-\($0)", movement: "Plank", kind: .recorded,
                                            text: String(repeating: "a", count: 1024))
        }
        XCTAssertThrowsError(try WorkoutSummaryEnvelope(headline: "Recorded work.", coverage: "Observed only.",
            cards: largeCards, defaultCardIds: [largeCards[0].id]))
        // Valid JSON with excessive whitespace must be rejected before decoding.
        let valid = try JSONEncoder().encode(empty)
        let oversized = Data(repeating: 32, count: WorkoutSummaryEnvelope.maximumEncodedBytes) + valid
        XCTAssertThrowsError(try WorkoutSummaryEnvelope.decodeTrustedEngineJSON(oversized))
    }

    func testMalformedAndOversizedModelWireOutputIsNeverRepaired() throws {
        let summary = try SummaryFixture.summary()
        for value in ["", "{", "{\"cardIds\":[\"set-1-focus\"]} trailing",
                      "```json\n{\"cardIds\":[\"set-1-focus\"]}\n```",
                      String(repeating: " ", count: 4096) + "null"] {
            let result = selectSummaryCards(summary, selection: Data(value.utf8))
            XCTAssertEqual(result.reason, .invalidSelection)
            XCTAssertEqual(result.cardIds, summary.defaultCardIds)
        }
        XCTAssertEqual(selectSummaryCards(summary, selection: Data(" \n null\t".utf8)).reason, .notRequested)
    }

    func testIDsUseJavaScriptIdentityWithoutUnicodeNormalization() throws {
        let composed = "caf\u{00e9}"
        let decomposed = "cafe\u{0301}"
        let card = try WorkoutSummaryEnvelope.Card(id: composed, movement: "Plank", kind: .recorded, text: "Recorded work.")
        let summary = try WorkoutSummaryEnvelope(headline: "Work.", coverage: "Observed only.",
                                                cards: [card], defaultCardIds: [composed])
        XCTAssertNil(summary.card(id: decomposed))
        XCTAssertEqual(selectSummaryCards(summary, selection: try SummaryFixture.json(["cardIds": [decomposed]])).reason,
                       .invalidSelection)
        let other = try WorkoutSummaryEnvelope.Card(id: decomposed, movement: "Plank", kind: .recorded, text: "Other work.")
        let distinct = try WorkoutSummaryEnvelope(headline: "Work.", coverage: "Observed only.",
                                                 cards: [card, other], defaultCardIds: [composed, decomposed])
        XCTAssertEqual(selectSummaryCards(distinct,
            selection: try SummaryFixture.json(["cardIds": [composed, decomposed]])).source, .onDevice)
    }

    func testStrictRawWireRejectsDuplicateKeysTrailingCommasAndInvalidSyntax() throws {
        let summary = try SummaryFixture.summary()
        // These are raw bytes, not parsed JS objects: JSONDecoder's extensions
        // must not turn an invalid provider response into an accepted selection.
        let invalid = [
            #"{"cardIds":["set-1-focus"],}"#,
            #"{"cardIds":["set-1-focus",]}"#,
            #"{"cardIds":["set-1-focus"],"cardIds":["unknown"]}"#,
            #"{"cardIds":["unknown"],"cardIds":["set-1-focus"]}"#,
            #"{"cardIds":["set-1-focus"],"cardIds":["set-1-focus"]}"#,
            #"{"cardIds":["set-1-focus"],"card\u0049ds":["set-1-work"]}"#,
            #"{"cardIds":["set-1-focus"]}{}"#,
            #"{"cardIds":["set-1-focus"]/*comment*/}"#,
            #"{"cardIds":["set-1-focus"]}//comment"#,
            #"{'cardIds':['set-1-focus']}"#,
            #"{cardIds:["set-1-focus"]}"#,
            #"{"cardIds":["set-1-focus"]"#,
            #"{"cardIds":["set-1-focus\"]}"#,
            #"{"cardIds":["set-1-\x66ocus"]}"#,
            #"{"cardIds":["set-1-\u006ocus"]}"#,
            #"{"cardIds":["set-1-focus\uD800"]}"#,
            "{\u{000b}\"cardIds\":[\"set-1-focus\"]}",
            "{\u{00a0}\"cardIds\":[\"set-1-focus\"]}",
            "{\"cardIds\":[\"set-1-focus\n\"]}",
            "n ull", "null,", "null null", "NULL"
        ]
        for raw in invalid {
            let result = selectSummaryCards(summary, selection: Data(raw.utf8))
            XCTAssertEqual(result.reason, .invalidSelection, raw)
            XCTAssertEqual(result.cardIds, summary.defaultCardIds, raw)
        }
        let invalidUTF8 = Data(#"{"cardIds":["set-1-focus"# .utf8) + Data([0xff]) + Data(#""]}"#.utf8)
        XCTAssertEqual(selectSummaryCards(summary, selection: invalidUTF8).reason, .invalidSelection)
        for raw in [
            " \r\n{ \t\"cardIds\" : [ \"set-1-focus\" ] } \n",
            #"{"card\u0049ds":["set-1-fo\u0063us"]}"#
        ] {
            let result = selectSummaryCards(summary, selection: Data(raw.utf8))
            XCTAssertEqual(result.source, .onDevice, raw)
            XCTAssertEqual(result.cardIds, ["set-1-focus"], raw)
        }
    }
}

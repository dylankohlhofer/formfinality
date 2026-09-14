import Foundation
import XCTest
@testable import FormCoachInteraction

final class ReviewChoiceTests: XCTestCase {
    private func bundle(count: Int = 3, detail: String = "Saved assertion needs human review.") -> [String: Any] {
        let hash = String(repeating: "a", count: 64)
        let candidates: [[String: Any]] = (0..<count).map { index in
            ["id": "review-" + String(format: "%064x", index), "caseId": "synthetic-case",
             "kind": "coverage gap", "detail": detail, "origin": "saved-result",
             "refs": ["report.json#/results/0"], "humanReviewRequired": true]
        }
        return ["schema": "ai-review-evidence/1", "reportHash": hash, "sourceHash": hash,
                "buildHash": hash, "evidenceHash": hash, "runStatus": "passed checks",
                "analyzerHashes": ["ai-review.mjs": hash, "audio-review.mjs": hash, "report.mjs": hash, "lib.mjs": hash],
                "selectionLimit": 2, "sources": [["file": "report.json", "sha256": hash]],
                "limitations": ["Synthetic software evidence only; not an accuracy verdict."],
                "cases": [["id": "synthetic-case", "mode": "engine", "status": "passed"]],
                "candidates": candidates]
    }

    func testTwentySixCandidatesAllReachFourBatchesAndFinalRequestIsBounded() throws {
        let input = try ReviewChoiceInput(evidence: ChoiceFixture.json(bundle(count: 26)))
        XCTAssertEqual(input.batches.map(\.count), [8, 8, 8, 2])
        XCTAssertEqual(input.batches.flatMap { $0 }.map(\.id), input.options.map(\.id))
        var winners: [CoachChoiceRequest.Option] = []
        var requestIDs = Set<String>()
        for (index, batch) in input.batches.enumerated() {
            let request = try input.request(options: batch, stage: "batch-\(index)")
            XCTAssertEqual(request.options.map(\.id), batch.map(\.id))
            XCTAssertEqual(request.purpose, .review)
            XCTAssertEqual(request.limit, 2)
            XCTAssertEqual(request.query, ReviewChoiceInput.query)
            XCTAssertTrue(requestIDs.insert(request.requestId).inserted)
            XCTAssertTrue(validateCoachChoiceRequest(try request.encodedJSON()))
            winners.append(contentsOf: batch.prefix(2))
        }
        let final = try input.request(options: winners, stage: "final")
        XCTAssertEqual(final.options.count, 8)
        XCTAssertTrue(requestIDs.insert(final.requestId).inserted)
        let outsideFinal = try ChoiceFixture.response([input.options[7].id])
        XCTAssertEqual(selectCoachChoices(final, selection: outsideFinal).reason, .invalidSelection)
        let valid = selectCoachChoices(final, selection: try ChoiceFixture.response([winners[0].id, winners[3].id]))
        XCTAssertEqual(valid.source, .onDevice)
        XCTAssertEqual(valid.choiceIds.count, 2)
    }

    func testMax64NoCandidateTruncationAndMultibyteOrEscapedContextStaysBounded() throws {
        for detail in [String(repeating: "\u{0000}", count: 600), String(repeating: "😀", count: 300)] {
            let input = try ReviewChoiceInput(evidence: ChoiceFixture.json(bundle(count: 64, detail: detail)))
            XCTAssertEqual(input.batches.count, 8)
            XCTAssertEqual(input.batches.flatMap { $0 }.count, 64)
            let winners = input.batches.flatMap { Array($0.prefix(2)) }
            let request = try input.request(options: winners, stage: "final")
            XCTAssertEqual(request.options.map(\.id), winners.map(\.id))
            XCTAssertLessThanOrEqual(try request.encodedJSON().count, 24 * 1024)
        }
        XCTAssertThrowsError(try ReviewChoiceInput(evidence: ChoiceFixture.json(bundle(count: 65)))) {
            XCTAssertEqual($0 as? ReviewChoiceInputError, .tooManyCandidates)
        }
    }

    func testEmptyBundleDoesNotBecomeModelSuccessAndUnknownOptionsCannotEnterAStage() throws {
        let empty = try ReviewChoiceInput(evidence: ChoiceFixture.json(bundle(count: 0)))
        XCTAssertEqual(empty.batches.count, 0)
        XCTAssertThrowsError(try empty.request(options: [], stage: "final"))
        let input = try ReviewChoiceInput(evidence: ChoiceFixture.json(bundle()))
        let invented = try CoachChoiceRequest.Option(id: "invented", title: "Invented", text: "Invented")
        XCTAssertThrowsError(try input.request(options: [invented], stage: "final"))
        XCTAssertThrowsError(try input.request(options: [input.options[0], input.options[0]], stage: "final"))
        let changedText = try CoachChoiceRequest.Option(id: input.options[0].id, title: "Changed", text: "Changed")
        XCTAssertThrowsError(try input.request(options: [changedText], stage: "final"))
    }

    func testInvalidBundleShapePrivateFieldsSourcesIDsAndRefsAreRejected() throws {
        let original = bundle()
        var variants: [[String: Any]] = []
        for key in original.keys {
            var removed = original; removed.removeValue(forKey: key); variants.append(removed)
        }
        for (key, value): (String, Any) in [
            ("schema", "private-diagnostics/2"), ("origin", "private"), ("recording", "recording.mov"),
            ("evidenceHash", "unknown"), ("runStatus", "running"), ("selectionLimit", true),
            ("selectionLimit", 3), ("selectionLimit", 8), ("cases", []), ("sources", []), ("analyzerHashes", [:])
        ] {
            var changed = original; changed[key] = value; variants.append(changed)
        }
        let candidates = try XCTUnwrap(original["candidates"] as? [[String: Any]])
        var duplicate = original; duplicate["candidates"] = candidates + [candidates[0]]; variants.append(duplicate)
        for (key, value): (String, Any) in [
            ("id", "unknown"), ("id", "review-" + String(repeating: "a", count: 64) + "\n"),
            ("caseId", "unknown"), ("kind", ""), ("origin", "model-inference"),
            ("refs", ["../../private.json#"]), ("refs", ["report.json"]), ("humanReviewRequired", false),
            ("humanReviewRequired", 1), ("action", "run-command")
        ] {
            var changed = original, edited = candidates; edited[0][key] = value
            changed["candidates"] = edited; variants.append(changed)
        }
        for (index, value) in variants.enumerated() {
            XCTAssertThrowsError(try ReviewChoiceInput(evidence: ChoiceFixture.json(value)), "variant \(index)")
        }
    }

    func testRawTransportRejectsRepeatedKeysTrailingCommasOversizeAndDeepNesting() throws {
        let valid = try ChoiceFixture.json(bundle())
        let text = String(decoding: valid, as: UTF8.self)
        let invalid = [String(text.dropLast()) + ",}",
                       String(text.dropLast()) + ",\"schema\":\"ai-review-evidence/1\"}",
                       text + "{}", "/*comment*/" + text,
                       String(repeating: "[", count: 42) + "0" + String(repeating: "]", count: 42),
                       "{\u{000b}\"schema\":null}"]
        for raw in invalid { XCTAssertThrowsError(try ReviewChoiceInput(evidence: Data(raw.utf8))) }
        XCTAssertThrowsError(try ReviewChoiceInput(evidence: Data(repeating: 32, count: 2 * 1024 * 1024) + valid))
    }
}

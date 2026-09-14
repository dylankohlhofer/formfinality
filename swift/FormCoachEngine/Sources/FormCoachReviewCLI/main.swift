import Foundation
import FormCoachInteraction
#if canImport(Darwin)
import Darwin
#else
import Glibc
#endif

/// Reads only explicitly named JSON files. No subprocesses, commands, network,
/// artifact discovery, golden writes, model prose, or automatic source receipts.
@main
struct FormCoachReviewCLI {
    static let usage = "Usage: formcoach-review --evidence <freshly-exported-synthetic-review-evidence.json>"

    @MainActor
    static func main() async {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            if args == ["--help"] { stderr(usage); return }
            guard args.count == 2, args[0] == "--evidence", !args[1].isEmpty,
                  !args[1].hasPrefix("--") else { throw CLIError.usage }
            // Invoking this dedicated reviewer is explicit opt-in. The Node
            // wrapper freshly verifies synthetic provenance and artifact hashes
            // before exporting this bundle; no source receipt is fabricated here.
            let evidence = try read(args[1], maximum: ReviewChoiceInput.maximumEvidenceBytes)
            let input = try ReviewChoiceInput(evidence: evidence)
            guard input.candidateCount > 0 else { throw CLIError.noCandidates }
            let coordinator = ChoiceCoordinator()
            var winners: [CoachChoiceRequest.Option] = []
            for (index, batch) in input.batches.enumerated() {
                let stage = "batch-\(index + 1)-of-\(input.batches.count)"
                let ids = try await select(input, options: batch, stage: stage, coordinator: coordinator)
                winners.append(contentsOf: ids.compactMap { id in input.options.first { $0.id == id } })
            }
            let finalIDs: [String]
            if input.batches.count > 1 {
                finalIDs = try await select(input, options: winners, stage: "final", coordinator: coordinator)
            } else { finalIDs = winners.map(\.id) }
            // Refuse output if the explicitly supplied file changed during AI.
            guard try read(args[1], maximum: ReviewChoiceInput.maximumEvidenceBytes) == evidence else {
                throw CLIError.staleEvidence
            }
            let output = Selection(schema: "ai-review-selection/1", reportHash: input.reportHash,
                evidenceHash: input.evidenceHash, selectedCandidateIds: finalIDs)
            // Only verified actual model selection gets JSON stdout. JS importReview
            // must still bind this result to current saved evidence/analyzer bytes.
            let bytes = try JSONEncoder().encode(output) + Data([10])
            try FileHandle.standardOutput.write(contentsOf: bytes)
        } catch let error as ReviewChoiceInputError {
            stderr("status=\(error.rawValue); actualModelSelected=false; humanReviewRequired=true")
            exit(2)
        } catch CLIError.usage {
            stderr(usage)
            exit(2)
        } catch let error as CLIError {
            stderr("status=\(error.rawValue); actualModelSelected=false; humanReviewRequired=true")
            exit(2)
        } catch {
            // Never echo imported text, prompts, response/error prose or file paths.
            stderr("status=input-or-output-error; actualModelSelected=false; humanReviewRequired=true")
            exit(2)
        }
    }

    @MainActor
    private static func select(_ input: ReviewChoiceInput, options: [CoachChoiceRequest.Option],
                               stage: String, coordinator: ChoiceCoordinator) async throws -> [String] {
        let request = try input.request(options: options, stage: stage)
        coordinator.show(request)
        guard let id = coordinator.current?.requestID else { throw CLIError.cancelled }
        await coordinator.requestOnDeviceSelection(for: id)
        guard let snapshot = coordinator.current else { throw CLIError.cancelled }
        let status = Status(stage: stage, candidateCount: input.candidateCount, stageOptionCount: options.count,
            status: statusCode(snapshot.status), availability: snapshot.modelAvailability?.rawValue,
            source: snapshot.selection.source.rawValue, actualModelSelected: snapshot.status == .selected,
            requestId: request.requestId, reportHash: input.reportHash, evidenceHash: input.evidenceHash,
            evidenceRevalidated: false, humanReviewRequired: true, accuracyVerdict: "not-assessed")
        stderr(String(decoding: try JSONEncoder().encode(status), as: UTF8.self))
        guard snapshot.status == .selected, snapshot.selection.source == .onDevice else { exit(2) }
        return snapshot.selection.choiceIds
    }

    private enum CLIError: String, Error { case usage, unreadableInput = "unreadable-input", privateInput = "private-input", oversized, noCandidates = "no-candidates-not-an-accuracy-pass", staleEvidence = "stale-evidence", cancelled }
    private struct Selection: Encodable {
        let schema: String
        let reportHash: String
        let evidenceHash: String
        let selectedCandidateIds: [String]
    }
    private struct Status: Encodable {
        let stage: String
        let candidateCount: Int
        let stageOptionCount: Int
        let status: String
        let availability: String?
        let source: String
        let actualModelSelected: Bool
        let requestId: String
        let reportHash: String
        let evidenceHash: String
        let evidenceRevalidated: Bool
        let humanReviewRequired: Bool
        let accuracyVerdict: String
    }
    private static func statusCode(_ status: ChoiceStatus) -> String {
        switch status {
        case .notRequested: return "not-requested"
        case .selecting: return "selecting"
        case .selected: return "selected"
        case .noOptions: return "no-options"
        case .invalidSelection: return "invalid-selection"
        case .unavailable(let state): return "unavailable-" + state.rawValue
        case .timedOut: return "timed-out"
        case .cancelled: return "cancelled"
        case .providerError: return "provider-error"
        }
    }
    private static func stderr(_ text: String) {
        FileHandle.standardError.write(Data((text + "\n").utf8))
    }
    private static func read(_ path: String, maximum: Int) throws -> Data {
        let resolved = URL(fileURLWithPath: path).resolvingSymlinksInPath().standardizedFileURL
        var components = resolved.pathComponents.map { $0.lowercased() }
        // /private/{tmp,var} are normal macOS temporary roots.
        if components.count > 2, components[1] == "private", ["tmp", "var"].contains(components[2]) {
            components.remove(at: 1)
        }
        guard !components.contains(where: { ["private", "recordings", "diagnostics"].contains($0) }) else {
            throw CLIError.privateInput
        }
        let fd = open(path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK)
        guard fd >= 0 else { throw CLIError.unreadableInput }
        defer { _ = close(fd) }
        var info = stat()
        guard fstat(fd, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG else { throw CLIError.unreadableInput }
        guard info.st_size <= maximum else { throw CLIError.oversized }
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        var data = Data()
        while data.count <= maximum {
            let chunk = try handle.read(upToCount: min(65536, maximum + 1 - data.count)) ?? Data()
            if chunk.isEmpty { break }
            data.append(chunk)
        }
        guard data.count <= maximum else { throw CLIError.oversized }
        return data
    }
}

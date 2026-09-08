import Foundation

// Codable mirrors of the browser's content schemas. Decoded from content-v4.8.json at
// the REPO ROOT — exported mechanically from the browser build so nothing is
// hand-transcribed, and read from the one canonical copy rather than a bundled duplicate
// (see the repoRoot note in ConformanceTests).

public struct MetricSpec: Codable {
    public let k: String                 // "angle" | "line" | "vert"
    public let v: String?                // angle vertex
    public let a: String?; public let b: String?; public let c: String?
    public let of: String?; public let from: String?; public let to: String?
    public let agg: String?              // camera | best | worst | mean
    public let sm: Double?               // EMA alpha override
}

public struct PoseTarget: Codable {
    public let id: String
    public let m: MetricSpec
    public let ideal: Double
    public let tol: Double
    public let range: Double
    public let w: Double?
    public let gate: Bool?               // quality gate — hold clock
    public let pos: Bool?                // position gate — arming
    public let optionalObservation: Bool? // use a visible hint, but do not require it
    public let above: String?
    public let below: String?
}

public struct RepSpec: Codable {
    public let driver: String
    public let rising: Bool?
    public let baseline: Bool?
    public let upBelow: Double?
    public let downAbove: Double?
    public let upAbove: Double?
    public let downBelow: Double?
    public let minMs: Double?
    public let shortCue: String?
    public let mult: Double?
}

public struct Breath: Codable {
    public let inhale: String?
    public let exhale: String?
    public let cycle: Double?
    enum CodingKeys: String, CodingKey { case inhale = "in", exhale = "out", cycle }
}

public struct Movement: Codable {
    public let name: String
    public let kind: String              // hold | reps | guided
    public let disc: String
    public let tiers: [String]
    public let regression: String?
    public let regressionOf: String?
    public let view: String?             // "front" for side planks
    public let camera: String?
    public let breath: Breath?
    public let targets: [PoseTarget]
    public let reps: RepSpec?
}

public struct TierSpec: Codable {
    public let label: String
    public let blurb: String
    public let tol: Double
    public let cueBudget: Int
    public let cueCool: Double           // ms
    public let effort: Double
    public let rest: Double
    public let setScale: Double?
    public let repMin: Double?
    public let showScore: Bool
    public let regress: Bool
}

public struct PlanStep: Codable, Equatable {
    public let ex: String?
    public let t: Double?
    public let sets: Int?
    public let setRest: Double?
    public let pre: String?
    public let rest: Double?
    public let intra: Bool?
    public let setNo: Int?
    public let setTotal: Int?
    public init(ex: String? = nil, t: Double? = nil, sets: Int? = nil, setRest: Double? = nil,
                pre: String? = nil, rest: Double? = nil, intra: Bool? = nil,
                setNo: Int? = nil, setTotal: Int? = nil) {
        self.ex = ex; self.t = t; self.sets = sets; self.setRest = setRest
        self.pre = pre; self.rest = rest; self.intra = intra
        self.setNo = setNo; self.setTotal = setTotal
    }
}

public struct Plan: Codable {
    public let id: String
    public let name: String
    public let disc: String
    public let tiers: [String]
    public let blurb: String
    public let steps: [PlanStep]
}

public struct RefAnim: Codable {
    public let loop: Bool?
    public let fps: Double
    public let labels: [String]?
    public let frames: [[String: [Double]]]
}

public struct ContentPack: Codable {
    public let tiers: [String: TierSpec]
    public let movements: [String: Movement]
    public let plans: [Plan]
    public let ref: [String: RefAnim]
    // dialogue is present in the JSON but not needed by the engine; ignored here.
}

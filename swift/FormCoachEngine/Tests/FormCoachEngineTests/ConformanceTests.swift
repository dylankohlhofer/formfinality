import XCTest
@testable import FormCoachEngine

/// Replays golden vectors recorded from the RUNNING browser engine (v4.7).
/// The browser build is the specification; these tests are the port's definition
/// of done. A failure names the scenario, frame and field that diverged.
final class ConformanceTests: XCTestCase {

    // ── vector schema ──
    struct Meta: Codable { let dt: Double; let tolerances: Tol }
    struct Tol: Codable { let value: Double; let score: Double; let hold: Double }
    struct ScoreRow: Codable { let movement, target, tier: String; let v: Double
        let score: Double; let cue: String? }
    struct MetricRow: Codable { let movement: String; let frame: Int; let target: String
        let v: Double? }
    struct AspectRow: Codable { let aspect: Double; let hipAngle: Double }
    struct PlanRow: Codable { let plan, tier: String; let steps: [PlanStep] }
    struct ClipVarsRow: Codable { let t: Int?; let p: String?; let x: String? }
    struct ClipRow: Codable { let key: String; let variant: Int; let vars: ClipVarsRow
        let tmpl: String; let manifest: [String]; let expect: [String]? }
    struct SlugRow: Codable { let `in`: String; let out: String }
    struct RepEventRow: Codable { let i: Int; let n: Int }
    struct RepRow: Codable { let name: String; let spec: RepSpec; let seq: [Double]
        let finalReps: Int; let finalState: String; let primed: Bool
        let events: [RepEventRow]; let base: Double? }
    struct Over: Codable { let sideness: Double? }
    struct TimelineStep: Codable { let pose: String?; let n: Int?; let over: Over?
        let action: String? }
    struct Checkpoint: Codable { let frame: Int; let ok: Bool; let inPosition: Bool
        let inPose: Bool; let blocking: [String]; let viewLimited: Bool
        let viewCue: String?; let score: Int?; let reps: Int; let state: String?
        let cue: String?; let suppressed: [String]; let regress: Bool
        let hold: Double; let guided: Bool }
    struct Scenario: Codable { let id, movement, tier: String
        let timeline: [TimelineStep]; let checkpoints: [Checkpoint] }
    struct FilterRow: Codable { let alpha: Double; let dt: Double; let out: Double }
    struct NeedRow: Codable { let movement: String; let need: [String] }
    struct FramingRow: Codable { let name: String; let box: [Double]
        let ok: Bool; let verdict: String; let dir: String? }
    struct SegPair: Codable { let a: String; let b: String; let sev: Int }
    struct TintDeriv: Codable { let movement: String; let target: String
        let focus: String?; let segs: [[String]] }
    struct TintPhase: Codable { let phase: String; let segs: [SegPair]; let focus: String? }
    struct TintScenario: Codable { let tier: String; let phases: [TintPhase] }
    struct TempoRow: Codable { let movement: String; let tier: String; let cycleSecs: Double
        let minMs: Double; let counted: Int; let rushed: Int }
    struct RateRow: Codable { let fps: Int; let probes: [String: Int]; let trace: Int }
    struct Vectors: Codable {
        let filters: [FilterRow]
        let tempo: [TempoRow]
        let tintDerivation: [TintDeriv]
        let tintScenarios: [TintScenario]
        let framing: [FramingRow]
        let neededJoints: [NeedRow]
        let frameRate: [RateRow]
        let meta: Meta
        let poses: [String: [String: [Double]]]
        let scoreTarget: [ScoreRow]
        let readMetric: [MetricRow]
        let aspect: [AspectRow]
        let planExpansion: [PlanRow]
        let clipResolver: [ClipRow]
        let slug: [SlugRow]
        let repScenarios: [RepRow]
        let evaluatorScenarios: [Scenario]
    }

    static var vec: Vectors!
    static var content: ContentPack!

    override class func setUp() {
        super.setUp()
        let vURL = Bundle.module.url(forResource: "Vectors/conformance-vectors", withExtension: "json")!
        let cURL = Bundle.module.url(forResource: "Vectors/content-v4.8", withExtension: "json")!
        vec = try! JSONDecoder().decode(Vectors.self, from: Data(contentsOf: vURL))
        content = try! ContentLoader.load(from: cURL)
    }

    // ── helpers ──
    func frame(pose name: String, over: Over?) -> PoseFrame {
        let src = Self.vec.poses[name]!
        var side: SideJoints = [:]
        for (k, xy) in src { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
        return PoseFrame(left: side, right: side, cam: "left", conf: 0.95,
                         aspect: nil, sideness: over?.sideness)
    }
    func refFrame(_ movement: String, _ idx: Int) -> PoseFrame {
        let f = Self.content.ref[movement]!.frames[idx]
        var side: SideJoints = [:]
        for (k, xy) in f where k != "spine" { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
        return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
    }

    // ── sections ──
    /// The filter conversion itself — identity at 30fps, and no update on a zero dt.
    func testFilterConversion() {
        for r in Self.vec.filters {
            XCTAssertEqual(emaAlpha(r.alpha, r.dt), r.out, accuracy: 1e-9,
                           "emaAlpha(alpha: \(r.alpha), dt: \(r.dt))")
        }
    }

    /// The SAME physical movement sampled at 24/30/60/90fps must score the same.
    /// Before dt-normalisation the filters ran ~3.7x faster at 90fps than at 24fps,
    /// so a threshold tuned in the browser would not survive a phone's frame rate.
    func testFrameRateIndependence() {
        let plank = Self.vec.poses["plank"]!
        var sagJ = plank
        sagJ["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.075]
        sagJ["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.03]

        func lerp(_ a: [String: [Double]], _ b: [String: [Double]], _ f: Double) -> [String: [Double]] {
            var o: [String: [Double]] = [:]
            for (k, v) in a { o[k] = [v[0] + (b[k]![0] - v[0]) * f, v[1] + (b[k]![1] - v[1]) * f] }
            return o
        }
        func poseAt(_ t: Double) -> [String: [Double]] {
            if t < 3 { return plank }
            if t < 4 { return lerp(plank, sagJ, t - 3) }
            if t < 7 { return sagJ }
            if t < 8 { return lerp(sagJ, plank, t - 7) }
            return plank
        }
        func frameOf(_ j: [String: [Double]]) -> PoseFrame {
            var side: SideJoints = [:]
            for (k, xy) in j { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
            return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
        }

        for row in Self.vec.frameRate {
            let dt = 1.0 / Double(row.fps)
            let ev = Evaluator(Self.content.movements["plank"]!,
                               tier: Self.content.tiers["building"]!)
            ev.arm(now: 0)
            var now = 0.0
            var r = FormResult()
            let wants = row.probes.keys.compactMap(Double.init).sorted()
            var wi = 0
            var got: [Double: Int] = [:]
            while now < 12 {
                now += dt
                r = ev.evaluate(frameOf(poseAt(now)), dt: dt, now: now)
                while wi < wants.count && now >= wants[wi] {
                    got[wants[wi]] = r.score ?? -999
                    wi += 1
                }
            }
            for (k, want) in row.probes {
                let t = Double(k)!
                XCTAssertEqual(Double(got[t] ?? -999), Double(want), accuracy: 2,
                               "\(row.fps)fps @t=\(k)s")
            }
            XCTAssertEqual(ev.scoreTrace.count, row.trace, "\(row.fps)fps trace density")
        }
    }

    /// minMs: a rep too fast to be controlled is rejected AND reported, and the
    /// floor scales by tier (Strong 0.6x). Declared in content since v4, enforced
    /// since v4.8 — the Swift port must not inherit the old silence.
    func testTempoFloor() {
        let dt = Self.vec.meta.dt
        for row in Self.vec.tempo {
            let spec = Self.content.movements[row.movement]!.reps!
            let scale = Self.content.tiers[row.tier]!.repMin ?? 1
            let rc = RepCounter(spec)
            let lo = (spec.rising == true) ? (spec.downBelow! - 8) : (spec.downAbove! + 8)
            let hi = (spec.rising == true) ? (spec.upAbove! + 8) : (spec.upBelow! - 8)
            let n = Int((row.cycleSecs / dt).rounded())
            var now = 0.0
            for _ in 0..<4 {
                for i in 0..<n {
                    now += dt
                    let f = Double(i) / Double(n)
                    let v = f < 0.5 ? lo + (hi - lo) * (f * 2) : hi + (lo - hi) * ((f - 0.5) * 2)
                    _ = rc.update(v, now: now, dt: dt, minScale: scale)
                }
            }
            XCTAssertEqual(rc.reps, row.counted,
                           "\(row.movement)@\(row.tier) \(row.cycleSecs)s counted")
            XCTAssertEqual(rc.rushed, row.rushed,
                           "\(row.movement)@\(row.tier) \(row.cycleSecs)s rushed")
        }
    }

    /// The tint is DERIVED from each metric spec, so no tint content is authored.
    /// All 68 targets must resolve identically in Swift.
    /// Framing verdicts — the bounding-box check must match the browser exactly,
    /// including which edge maps to which nudge.
    /// Framing only insists on the joints a movement actually measures — a crunch
    /// doesn't grade your feet, so feet out of frame must not block reps.
    func testNeededJoints() {
        for row in Self.vec.neededJoints {
            let mv = Self.content.movements[row.movement]!
            XCTAssertEqual(neededJoints(mv).sorted(), row.need, row.movement)
        }
    }

    func testFraming() {
        for row in Self.vec.framing {
            let (x0,y0,x1,y1) = (row.box[0], row.box[1], row.box[2], row.box[3])
            func at(_ fx: Double, _ fy: Double) -> Joint {
                Joint(x: x0+(x1-x0)*fx, y: y0+(y1-y0)*fy, c: 0.95)
            }
            let side: SideJoints = ["ear": at(0,0), "shoulder": at(0.5,0.1),
                "elbow": at(0.3,0.35), "wrist": at(0,0.5), "hip": at(0.5,0.5),
                "knee": at(0.7,0.75), "ankle": at(1,1), "heel": at(0.9,0.9), "toe": at(1,0.85)]
            let f = framing(PoseFrame(left: side, right: side, cam: "left", conf: 0.95))
            XCTAssertEqual(f.ok, row.ok, "\(row.name) ok")
            XCTAssertEqual(f.verdict, row.verdict, "\(row.name) verdict")
            XCTAssertEqual(f.dir, row.dir, "\(row.name) dir")
        }
    }

    func testTintDerivation() {
        for row in Self.vec.tintDerivation {
            let t = Self.content.movements[row.movement]!.targets.first { $0.id == row.target }!
            let got = tintSegs(t.m)
            XCTAssertEqual(got.focus, row.focus, "\(row.movement).\(row.target) focus")
            XCTAssertEqual(got.segs.count, row.segs.count, "\(row.movement).\(row.target) seg count")
            for (i, pair) in row.segs.enumerated() {
                XCTAssertEqual(got.segs[i].0, pair[0], "\(row.movement).\(row.target) seg \(i).a")
                XCTAssertEqual(got.segs[i].1, pair[1], "\(row.movement).\(row.target) seg \(i).b")
            }
        }
    }

    /// Severity through a scripted sag, per tier — including the hysteresis latch and
    /// the Learning rule (one part, amber only, never red).
    func testTintScenarios() {
        let dt = Self.vec.meta.dt
        let plank = Self.vec.poses["plank"]!
        var mild = plank, bad = plank
        mild["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.045]
        mild["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.02]
        bad["hip"] = [plank["hip"]![0], plank["hip"]![1] + 0.10]
        bad["knee"] = [plank["knee"]![0], plank["knee"]![1] + 0.05]
        func frameOf(_ j: [String: [Double]]) -> PoseFrame {
            var side: SideJoints = [:]
            for (k, xy) in j { side[k] = Joint(x: xy[0], y: xy[1], c: 0.95) }
            return PoseFrame(left: side, right: side, cam: "left", conf: 0.95)
        }
        for sc in Self.vec.tintScenarios {
            let ev = Evaluator(Self.content.movements["plank"]!,
                               tier: Self.content.tiers[sc.tier]!)
            ev.arm(now: 0)
            var now = 0.0
            var r = FormResult()
            let steps: [(String, [String: [Double]], Int)] =
                [("clean", plank, 40), ("mild", mild, 60), ("bad", bad, 60), ("clean", plank, 90)]
            for (i, step) in steps.enumerated() {
                for _ in 0..<step.2 { now += dt; r = ev.evaluate(frameOf(step.1), dt: dt, now: now) }
                let want = sc.phases[i]
                let got = r.tint.segs
                    .map { SegPair(a: $0.a, b: $0.b, sev: $0.sev) }
                    .sorted { ($0.a + $0.b) < ($1.a + $1.b) }
                XCTAssertEqual(got.count, want.segs.count, "\(sc.tier)/\(want.phase) seg count")
                for (n, w) in want.segs.enumerated() where n < got.count {
                    XCTAssertEqual(got[n].a, w.a, "\(sc.tier)/\(want.phase) seg \(n).a")
                    XCTAssertEqual(got[n].b, w.b, "\(sc.tier)/\(want.phase) seg \(n).b")
                    XCTAssertEqual(got[n].sev, w.sev, "\(sc.tier)/\(want.phase) seg \(n).sev")
                }
                XCTAssertEqual(r.tint.focus, want.focus, "\(sc.tier)/\(want.phase) focus")
            }
        }
    }

    func testScoreAndCues() {
        for r in Self.vec.scoreTarget {
            let mv = Self.content.movements[r.movement]!
            let t = mv.targets.first { $0.id == r.target }!
            let tt = Self.content.tiers[r.tier]!.tol
            XCTAssertEqual(scoreTarget(t, r.v, tierTol: tt), r.score,
                           accuracy: Self.vec.meta.tolerances.score,
                           "\(r.movement).\(r.target)@\(r.tier) v=\(r.v)")
            XCTAssertEqual(cueFor(t, r.v, tierTol: tt), r.cue,
                           "cue \(r.movement).\(r.target)@\(r.tier) v=\(r.v)")
        }
    }

    func testReadMetricOverRefFrames() {
        for r in Self.vec.readMetric {
            let mv = Self.content.movements[r.movement]!
            let t = mv.targets.first { $0.id == r.target }!
            let got = readMetric(t.m, refFrame(r.movement, r.frame), "left")
            if let want = r.v {
                XCTAssertNotNil(got, "\(r.movement)[\(r.frame)].\(r.target)")
                XCTAssertEqual(got!, want, accuracy: Self.vec.meta.tolerances.value,
                               "\(r.movement)[\(r.frame)].\(r.target)")
            } else { XCTAssertNil(got) }
        }
    }

    func testAspectEquivalence() {
        let mv = Self.content.movements["downward-dog"]!
        let spec = mv.targets.first { $0.id == "hipAngle" }!.m
        let phys = Self.content.ref["downward-dog"]!.frames[1]
        for row in Self.vec.aspect {
            var side: SideJoints = [:]
            for (k, xy) in phys where k != "spine" {
                side[k] = Joint(x: xy[0] / row.aspect, y: xy[1], c: 0.95)
            }
            let fr = PoseFrame(left: side, right: side, cam: "left", conf: 0.95, aspect: row.aspect)
            XCTAssertEqual(readMetric(spec, fr, "left")!, row.hipAngle,
                           accuracy: Self.vec.meta.tolerances.value, "aspect \(row.aspect)")
        }
    }

    func testPlanExpansion() {
        for r in Self.vec.planExpansion {
            let plan = Self.content.plans.first { $0.id == r.plan }!
            let got = expandPlanSteps(plan.steps, tier: Self.content.tiers[r.tier]!)
            XCTAssertEqual(got, r.steps, "\(r.plan)@\(r.tier)")
        }
    }

    func testClipResolverAndSlug() {
        for r in Self.vec.slug { XCTAssertEqual(slugTok(r.in), r.out) }
        for r in Self.vec.clipResolver {
            let man = Set(r.manifest)
            let got = clipPlanFor(personaId: "warm", tierId: "building", key: r.key,
                                  variant: r.variant,
                                  vars: ClipVars(t: r.vars.t, p: r.vars.p, x: r.vars.x),
                                  tmpl: r.tmpl, has: { man.contains($0) })
            XCTAssertEqual(got, r.expect, "clip \(r.key) \(r.tmpl)")
        }
    }

    func testRepScenarios() {
        let dt = Self.vec.meta.dt
        for r in Self.vec.repScenarios {
            let rc = RepCounter(r.spec)
            var now = 0.0
            var events: [(Int, Int)] = []
            for (i, v) in r.seq.enumerated() {
                now += dt
                if let ev = rc.update(v, now: now) { events.append((i, ev.n)) }
            }
            XCTAssertEqual(rc.reps, r.finalReps, "\(r.name) reps")
            XCTAssertEqual(rc.state, r.finalState, "\(r.name) state")
            XCTAssertEqual(rc.primed, r.primed, "\(r.name) primed")
            XCTAssertEqual(events.map { $0.0 }, r.events.map { $0.i }, "\(r.name) event frames")
            if let b = r.base { XCTAssertEqual(rc.base ?? .nan, b, accuracy: 0.1, "\(r.name) base") }
        }
    }

    func testEvaluatorScenarios() {
        let dt = Self.vec.meta.dt
        let tol = Self.vec.meta.tolerances
        for sc in Self.vec.evaluatorScenarios {
            let ev = Evaluator(Self.content.movements[sc.movement]!,
                               tier: Self.content.tiers[sc.tier]!)
            var now = 0.0
            var r = FormResult()
            var frameIdx = 0
            var cpIdx = 0
            for step in sc.timeline {
                if step.action == "arm" { ev.arm(now: now); continue }
                if step.action == "check" {
                    let want = sc.checkpoints[cpIdx]; cpIdx += 1
                    let tag = "\(sc.id)@frame\(frameIdx - 1)"
                    XCTAssertEqual(r.ok, want.ok, "\(tag).ok")
                    XCTAssertEqual(r.inPosition, want.inPosition, "\(tag).inPosition")
                    XCTAssertEqual(r.inPose, want.inPose, "\(tag).inPose")
                    XCTAssertEqual(r.blocking, want.blocking, "\(tag).blocking")
                    XCTAssertEqual(r.viewLimited, want.viewLimited, "\(tag).viewLimited")
                    XCTAssertEqual(r.viewCue, want.viewCue, "\(tag).viewCue")
                    XCTAssertEqual(r.reps, want.reps, "\(tag).reps")
                    XCTAssertEqual(r.state, want.state, "\(tag).state")
                    XCTAssertEqual(r.cue, want.cue, "\(tag).cue")
                    XCTAssertEqual(r.suppressed, want.suppressed, "\(tag).suppressed")
                    XCTAssertEqual(r.regress, want.regress, "\(tag).regress")
                    XCTAssertEqual(r.guided, want.guided, "\(tag).guided")
                    XCTAssertEqual(ev.hold, want.hold, accuracy: tol.hold, "\(tag).hold")
                    if let ws = want.score {
                        XCTAssertEqual(Double(r.score ?? -999), Double(ws),
                                       accuracy: tol.score, "\(tag).score")
                    } else { XCTAssertNil(r.score, "\(tag).score-nil") }
                    continue
                }
                guard let pose = step.pose, let n = step.n else { continue }
                for _ in 0..<n {
                    now += dt
                    r = ev.evaluate(frame(pose: pose, over: step.over), dt: dt, now: now)
                    frameIdx += 1
                }
            }
            XCTAssertEqual(cpIdx, sc.checkpoints.count, "\(sc.id): all checkpoints consumed")
        }
    }
}

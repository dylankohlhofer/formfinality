import Foundation

public struct Reading {
    public let target: PoseTarget
    public var v: Double
    public let s: Double
    public let cue: String?
}

public struct MissingEvidence: Codable, Equatable {
    public let target: String
    public let reason: String?
}

public struct ObservedEvidence: Codable, Equatable {
    public let target: String
    public let sides: [String]
}

public struct MovementObservation: Codable, Equatable {
    public var status = "unavailable"
    public var eligible = false
    public var missing: [MissingEvidence] = []
    public var source: String? = nil
}

public struct FormObservation: Codable, Equatable {
    public var status = "unavailable"
    public var observed: [ObservedEvidence] = []
    public var missing: [MissingEvidence] = []
}

/// Camera evidence is separate from geometry, form quality and completed work.
public struct MovementEvidence: Codable, Equatable {
    public var schema = "movement-evidence/1"
    public var movement = MovementObservation()
    public var form = FormObservation()
}

public struct FormResult {
    public var readings: [Reading] = []
    public var cue: String? = nil
    public var inPose = false
    public var inPosition = false
    public var blocking: [String] = []
    public var score: Int? = nil
    public var rep: RepEvent? = nil
    public var repPaused = false
    public var observationPaused = false
    public var evidence = MovementEvidence()
    /// Set at the up-crossing, one whole half-cycle BEFORE `rep`. `reps` does not move
    /// with it. The shell turns this into the repPeak effect; `rep` is what counts.
    public var atPeak: RepEvent? = nil
    public var tooFast: RepEvent? = nil
    public var reps = 0
    public var ok = true
    public var regress = false
    public var suppressed: [String] = []
    public var sideness: Double? = nil
    public var viewLimited = false
    public var viewCue: String? = nil
    public var guided = false
    public var state: String? = nil
    public var short: RepEvent? = nil
    public var tint = Tint()
    public var framing = Framing(ok: true, verdict: "unsure")
}

/// Which limbs to colour. Derived from the metric spec itself — a spec already
/// NAMES its joints, so no tint content is ever authored.
public struct TintSeg: Equatable { public let a: String; public let b: String; public let sev: Int }
public struct Tint { public var segs: [TintSeg] = []; public var focus: String? = nil }

public func tintSegs(_ m: MetricSpec) -> (segs: [(String, String)], focus: String?) {
    if m.k == "angle", let v = m.v, let a = m.a, let c = m.c { return ([(v, a), (v, c)], v) }
    if m.k == "line", let o = m.of, let f = m.from, let t = m.to { return ([(f, o), (o, t)], o) }
    if m.k == "vert", let a = m.a, let b = m.b { return ([(a, b)], b) }
    return ([], nil)
}
/// Hysteresis, for the same reason rep counting needs it: a joint on a band edge
/// would otherwise strobe between amber and red every frame.
let TINT_IN: [Double] = [78, 52]
let TINT_OUT: [Double] = [86, 62]

public struct LogEntry { public let key: String; public let at: Double }
public struct TracePoint { public let t: Double; public let s: Int }

/// 1:1 transcription of the browser Evaluator — pos/quality gate split, view awareness,
/// w:0-safe score pool, worst-offender cue with budget+cooldown, priming'd reps,
/// timestamped corrections. The conformance vectors are the proof of parity.

/// Framing — the "stand 2 metres back" problem solved by looking, not asking. A
/// bounding box over the confident joints, on data PoseFrame already carries. Pure
/// geometry; returns a verdict and which way to nudge.
public struct Framing { public var ok: Bool; public var verdict: String
    public var dir: String? = nil; public var fill: Double = 0 }

/// Full judging-joint inventory retained for content/vector parity. Required
/// movement evidence is derived separately by movementTargets, not this union.
public func neededJoints(_ mv: Movement) -> Set<String> {
    func add(_ s: inout Set<String>, _ m: MetricSpec) {
        if m.k == "angle" { for j in [m.v, m.a, m.c] { if let j { s.insert(j) } } }
        else if m.k == "line" { for j in [m.of, m.from, m.to] { if let j { s.insert(j) } } }
        else if m.k == "vert" { for j in [m.a, m.b] { if let j { s.insert(j) } } }
    }
    var judging = Set<String>()
    for t in mv.targets where !(t.pos ?? false) { add(&judging, t.m) }
    if !judging.isEmpty { return judging }
    var setup = Set<String>()
    for t in mv.targets where (t.pos ?? false) { add(&setup, t.m) }
    return setup
}

public func framing(_ frame: PoseFrame, need: Set<String>? = nil) -> Framing {
    var pts: [Joint] = []
    var all: [Joint] = []
    for side in [frame.left, frame.right] {
        for (j, p) in side where p.x.isFinite && p.y.isFinite && !(p.c <= 0.4) {
            all.append(p)
            if let need, !need.isEmpty, !need.contains(j) { continue }
            pts.append(p)
        }
    }
    if all.count < 4 || pts.count < 2 { return Framing(ok: true, verdict: "unsure") }
    var minX = 1.0, maxX = 0.0, minY = 1.0, maxY = 0.0
    for p in pts { minX = min(minX, p.x); maxX = max(maxX, p.x)
                   minY = min(minY, p.y); maxY = max(maxY, p.y) }
    var bodyX0 = 1.0, bodyX1 = 0.0, bodyY0 = 1.0, bodyY1 = 0.0
    for p in all { bodyX0 = min(bodyX0, p.x); bodyX1 = max(bodyX1, p.x)
                   bodyY0 = min(bodyY0, p.y); bodyY1 = max(bodyY1, p.y) }
    let w = maxX - minX, h = maxY - minY, M = 0.02
    let cl = (l: minX < M, r: maxX > 1 - M, t: minY < M, b: maxY > 1 - M)
    if cl.l || cl.r || cl.t || cl.b {
        let vBoth = cl.t && cl.b, hBoth = cl.l && cl.r
        var dir = "back"
        if !vBoth && !hBoth {
            if cl.t { dir = "down" } else if cl.b { dir = "up" }
            else if cl.l { dir = "right" } else if cl.r { dir = "left" }
        }
        return Framing(ok: false, verdict: "clipped", dir: dir, fill: max(w, h))
    }
    let fill = max(bodyX1 - bodyX0, bodyY1 - bodyY0)
    if fill < 0.35 { return Framing(ok: true, verdict: "far", fill: fill) }
    return Framing(ok: true, verdict: "framed", fill: fill)
}

func metricJoints(_ m: MetricSpec) -> [String] {
    switch m.k {
    case "angle": return [m.v, m.a, m.c].compactMap { $0 }
    case "line": return [m.of, m.from, m.to].compactMap { $0 }
    case "vert": return [m.a, m.b].compactMap { $0 }
    default: return []
    }
}

struct TargetObservation {
    var sides: [String]
    var reason: String?
    var raw: Double? = nil
}

func targetObservation(_ t: PoseTarget, _ frame: PoseFrame) -> TargetObservation {
    let names = (t.m.agg ?? "camera") == "camera" ? [frame.cam] : ["left", "right"]
    let joints = metricJoints(t.m)
    var clipped = false
    let visible = names.filter { side in
        !joints.isEmpty && joints.allSatisfy { joint in
            guard let p = frame.side(side)[joint], p.c.isFinite, p.c >= 0.5,
                  p.x.isFinite, p.y.isFinite else { return false }
            if p.x < 0.02 || p.x > 0.98 || p.y < 0.02 || p.y > 0.98 {
                clipped = true
                return false
            }
            return true
        }
    }
    let sides = visible.filter { side in
        let points = frame.side(side), metric = t.m, aspect = frame.aspect ?? 1
        guard aspect.isFinite, aspect > 0 else { return false }
        func distinct(_ a: String?, _ b: String?) -> Bool {
            guard let a, let b, let first = points[a], let second = points[b] else { return false }
            return hypot((first.x - second.x) * aspect, first.y - second.y) >= 1e-9
        }
        if metric.k == "vert" && !distinct(metric.a, metric.b) { return false }
        if metric.k == "line" && !distinct(metric.from, metric.to) { return false }
        guard let value = readMetric(metric, frame, side) else { return false }
        return value.isFinite
    }
    let reason: String? = !sides.isEmpty ? nil : !visible.isEmpty ? "unreadable" : clipped ? "clipped" : "tracking"
    return TargetObservation(sides: sides, reason: reason)
}

func movementTargets(_ mv: Movement) -> [PoseTarget] {
    mv.targets.filter {
        (($0.pos ?? false) && !($0.optionalObservation ?? false)) ||
        $0.id == mv.reps?.driver || (mv.kind != "reps" && ($0.gate ?? false))
    }
}

public final class Evaluator {
    let mv: Movement
    let tier: TierSpec
    var ema: [String: Double] = [:]
    public var score = 100.0
    var sum = 0.0
    var n = 0
    public var hold = 0.0
    public var corrections: [String: Int] = [:]
    var raised = Set<String>()
    public var suppressed: [String] = []
    var lastCueAt = -1e9
    public var outOfPose = 0.0
    public var log: [LogEntry] = []
    public var scoreTrace: [TracePoint] = []
    var armedAt: Double? = nil
    var lastTraceBucket = -1
    var sev: [String: Int] = [:]        // latched tint severity
    let movementNeed: Set<String>
    var scorePool: String? = nil
    var driverSource: String? = nil
    var targetSources: [String: String] = [:]
    public var rep: RepCounter?

    public init(_ mv: Movement, tier: TierSpec) {
        self.movementNeed = Set(movementTargets(mv).flatMap { metricJoints($0.m) })
        self.mv = mv
        self.tier = tier
        self.rep = mv.reps.map { RepCounter($0) }
    }

    func smooth(_ id: String, _ v: Double, alpha: Double, dt: Double) -> Double {
        let next = ema[id].map { $0 + emaAlpha(alpha, dt) * (v - $0) } ?? v
        ema[id] = next
        return next
    }

    func read(_ t: PoseTarget, _ frame: PoseFrame) -> Double? {
        let agg = t.m.agg ?? "camera"
        if agg == "camera" { return readMetric(t.m, frame, frame.cam) }
        let l = readMetric(t.m, frame, "left")
        let r = readMetric(t.m, frame, "right")
        guard let lv = l else { return r }
        guard let rv = r else { return lv }
        if agg == "mean" { return (lv + rv) / 2 }
        let sl = scoreTarget(t, lv, tierTol: tier.tol)
        let sr = scoreTarget(t, rv, tierTol: tier.tol)
        if agg == "best"  { return sl >= sr ? lv : rv }
        if agg == "worst" { return sl <= sr ? lv : rv }
        return lv
    }

    public func interrupt() {
        driverSource = nil
        rep?.interrupt()
        ema = [:]; sev = [:]; targetSources = [:]; scorePool = ""
    }

    public func evaluate(_ frame: PoseFrame, dt: Double, now: Double) -> FormResult {
        var out = FormResult()
        out.reps = rep?.display() ?? 0

        var observations: [String: TargetObservation] = [:]
        for t in mv.targets {
            var observation = targetObservation(t, frame)
            var observedFrame = frame
            if !observation.sides.contains("left") { observedFrame.left = [:] }
            if !observation.sides.contains("right") { observedFrame.right = [:] }
            let raw = observation.sides.isEmpty ? nil : read(t, observedFrame)
            if !observation.sides.isEmpty && (raw == nil || !raw!.isFinite) {
                observation.sides = []; observation.reason = "unreadable"
            }
            observation.raw = observation.sides.isEmpty ? nil : raw
            observations[t.id] = observation
        }
        let required = movementTargets(mv)
        let missing = required.filter { observations[$0.id]!.sides.isEmpty }.map {
            MissingEvidence(target: $0.id, reason: observations[$0.id]!.reason)
        }
        let formTargets = mv.kind == "guided" ? [] : mv.targets.filter {
            (rep == nil || (!($0.pos ?? false) && $0.id != mv.reps?.driver)) &&
            (($0.w ?? 1) > 0 || ($0.gate ?? false))
        }
        out.evidence.movement.status = missing.isEmpty ? "observed" : "unavailable"
        out.evidence.movement.missing = missing
        for t in formTargets {
            let observation = observations[t.id]!
            if !observation.sides.isEmpty {
                out.evidence.form.observed.append(ObservedEvidence(target: t.id, sides: observation.sides))
            } else {
                out.evidence.form.missing.append(MissingEvidence(target: t.id, reason: observation.reason))
            }
        }
        out.evidence.form.status = formTargets.isEmpty ? "unscored" :
            out.evidence.form.observed.isEmpty ? "unavailable" :
            out.evidence.form.missing.isEmpty ? "complete" : "partial"

        // Required targets request framing only on complete observed sides. Retain
        // unrelated visible joints for the whole-body distance estimate.
        var framingFrame = frame
        for j in movementNeed {
            framingFrame.left.removeValue(forKey: j)
            framingFrame.right.removeValue(forKey: j)
        }
        for t in required {
            let observation = observations[t.id]!
            let sides = observation.sides.isEmpty ?
                ((t.m.agg ?? "camera") == "camera" ? [frame.cam] : ["left", "right"]) : observation.sides
            for side in sides {
                for j in metricJoints(t.m) {
                    if let p = frame.side(side)[j] {
                        if side == "left" { framingFrame.left[j] = p } else { framingFrame.right[j] = p }
                    }
                }
            }
        }
        out.framing = framing(framingFrame, need: movementNeed)
        func observedRead(_ t: PoseTarget) -> Double? {
            guard let raw = observations[t.id]!.raw, raw.isFinite else {
                ema.removeValue(forKey: t.id); sev.removeValue(forKey: t.id)
                targetSources.removeValue(forKey: t.id)
                let key = "unobserved⊘" + t.id
                if !out.suppressed.contains(key) { out.suppressed.append(key) }
                return nil
            }
            let source = observations[t.id]!.sides.joined(separator: "+")
            if let previous = targetSources[t.id], previous != source {
                ema.removeValue(forKey: t.id); sev.removeValue(forKey: t.id)
            }
            targetSources[t.id] = source
            return raw
        }
        if !observations.values.contains(where: { !$0.sides.isEmpty }) {
            if out.framing.verdict == "clipped" { out.blocking.append("framing") }
            interrupt(); out.ok = false; return out
        }

        // GUIDED — position checked, no claims about quality.
        if mv.kind == "guided" {
            for t in mv.targets {
                guard let raw = observedRead(t) else { continue }
                let v = smooth(t.id, raw, alpha: (t.m.sm == nil || t.m.sm == 0) ? 0.35 : t.m.sm!, dt: dt)
                out.readings.append(Reading(target: t, v: v,
                    s: scoreTarget(t, v, tierTol: tier.tol), cue: nil))
            }
            let gates = out.readings.filter { ($0.target.pos ?? false) || ($0.target.gate ?? false) }
            out.inPose = missing.isEmpty && gates.allSatisfy { $0.s > 0 }
            out.inPosition = out.inPose
            out.blocking = missing.map { $0.target } + gates.filter { $0.s <= 0 }.map { $0.target.id }
            // "far" is a quality nudge; a clipped body cannot arm the set.
            if out.framing.verdict == "clipped" {
                out.inPosition = false
                out.inPose = false
                out.blocking.append("framing")
            }
            if out.inPose { hold += dt }
            out.evidence.movement.eligible = out.inPose
            out.guided = true
            return out
        }

        for t in mv.targets {
            guard let raw = observedRead(t) else { continue }
            let v = smooth(t.id, raw, alpha: (t.m.sm == nil || t.m.sm == 0) ? 0.35 : t.m.sm!, dt: dt)
            out.readings.append(Reading(target: t, v: v,
                s: scoreTarget(t, v, tierTol: tier.tol),
                cue: cueFor(t, v, tierTol: tier.tol)))
        }
        if out.readings.isEmpty { interrupt(); out.ok = false; return out }

        // POSITION gates decide arming; QUALITY gates decide only the hold clock.
        let posGates = out.readings.filter { $0.target.pos ?? false }
        out.inPosition = missing.isEmpty && posGates.allSatisfy { $0.s > 0 }
        let qGates = out.readings.filter { $0.target.gate ?? false }
        let missingGates = mv.targets.filter { t in
            (t.gate ?? false) && !out.readings.contains { $0.target.id == t.id }
        }
        out.inPose = out.inPosition && missingGates.isEmpty && qGates.allSatisfy { $0.s > 0 }
        for key in missing.map({ $0.target }) + missingGates.map({ $0.id }) +
            (posGates + qGates).filter({ $0.s <= 0 }).map({ $0.target.id }) {
            if !out.blocking.contains(key) { out.blocking.append(key) }
        }
        // Previously this guard was accidentally present only in the guided branch.
        if out.framing.verdict == "clipped" {
            out.inPosition = false; out.inPose = false
            if !out.blocking.contains("framing") { out.blocking.append("framing") }
        }

        // VIEW AWARENESS — say less off-axis, never wrong things.
        out.sideness = frame.sideness
        if let sn = frame.sideness {
            let wantsFront = mv.view == "front"
            let aligned = wantsFront ? (90 - sn) : sn
            if aligned < 25 {
                out.inPosition = false
                out.inPose = false
                out.blocking.append("view")
                out.viewCue = wantsFront ? "turnfront" : "turnside"
            } else if aligned < 50 {
                out.viewLimited = true
            }
        }

        if !missing.isEmpty && rep == nil {
            out.observationPaused = true
            if missing.contains(where: { $0.reason != "clipped" }) { out.blocking.append("tracking") }
            interrupt(); outOfPose = 0
            return out
        }

        if rep != nil, let spec = mv.reps {
            let rawBlocked = mv.targets.filter { $0.pos ?? false }.filter { t in
                guard let v = observedRead(t) else { return !(t.optionalObservation ?? false) }
                return scoreTarget(t, v, tierTol: tier.tol) <= 0
            }.map { $0.id }
            let driverIndex = out.readings.firstIndex { $0.target.id == spec.driver }
            let driverSides = observations[spec.driver]!.sides
            let driverVisible = !driverSides.isEmpty
            if !out.inPosition || !rawBlocked.isEmpty || driverIndex == nil || !driverVisible {
                for key in rawBlocked + ((driverIndex == nil || !driverVisible) ? ["tracking"] : []) {
                    if !out.blocking.contains(key) { out.blocking.append(key) }
                }
                out.inPosition = false; out.inPose = false; out.repPaused = true
                out.suppressed += out.readings.compactMap { $0.cue.map { "unobserved⊘" + $0 } }
                interrupt()
                return out
            }
            let source = driverSides.joined(separator: "+")
            if let driverSource, driverSource != source {
                interrupt()
                let index = driverIndex!
                let target = out.readings[index].target
                let raw = observedRead(target)!
                out.readings[index].v = raw
                ema[target.id] = raw
            }
            driverSource = source
            out.evidence.movement.source = source
        }
        out.evidence.movement.eligible = rep != nil ? out.inPosition : out.inPose

        // Drivers measure cycle range/tempo, not static posture. Empty means nil.
        func wOf(_ r: Reading) -> Double { r.target.w ?? 1 }
        let quality = out.readings.filter { rep == nil || (!($0.target.pos ?? false) && $0.target.id != mv.reps?.driver) }
        var pool = quality.filter { !($0.target.gate ?? false) && wOf($0) > 0 }
        if pool.isEmpty { pool = quality.filter { ($0.target.gate ?? false) && !($0.target.pos ?? false) } }
        let poolKey = pool.map {
            $0.target.id + ":" + observations[$0.target.id]!.sides.joined(separator: "+")
        }.joined(separator: "|")
        let changedPool = scorePool != nil && scorePool != poolKey
        scorePool = poolKey
        if !pool.isEmpty {
        let tw = pool.reduce(0.0) { $0 + max(wOf($1), 0.001) }
        let raw = pool.reduce(0.0) { $0 + $1.s * max(wOf($1), 0.001) } / tw
        score = changedPool ? raw : score + emaAlpha(0.1, dt) * (raw - score)
        sum += score; n += 1
        out.score = Int(score.rounded())
        // 5 Hz by clock BUCKET — frame counting sampled twice as often at 60fps,
        // and a naive elapsed-time check drifts on float accumulation.
        if let a = armedAt {
            let bucket = Int(((now - a) / 0.2).rounded(.down))
            if bucket > lastTraceBucket {
                lastTraceBucket = bucket
                scoreTrace.append(TracePoint(t: ((now - a) * 10).rounded() / 10, s: Int(score.rounded())))
            }
        }
        }

        if mv.kind == "hold" {
            if out.inPose { hold += dt; outOfPose = 0 }
            else { outOfPose += dt }
            if outOfPose > 6, mv.regression != nil, tier.regress { out.regress = true }
        }

        // THE REP COUNTER RUNS ONLY ONCE THE SET HAS ARMED. It used to update on
        // every evaluated frame, including the whole of GET SET, so lowering yourself
        // into position was fed to the same hysteresis that counts reps. arm() resets
        // the count, so the leak never reached the big counter — it reached the
        // telemetry panel and the CSV reps column. Priming helped and did not cure it:
        // a squat's rest position IS standing, so walking into frame primes it.
        if let rc = rep, let spec = mv.reps, armedAt != nil {
            if let driver = out.readings.first(where: { $0.target.id == spec.driver }) {
                if let ev = rc.update(driver.v, now: now, dt: dt, minScale: tier.repMin ?? 1) {
                    // atPeak needs a branch of its OWN, ahead of the final else.
                    // Drop it and the up-crossing falls through to `rep`: the shell
                    // is told the rep completed at the top of the movement and again
                    // at the bottom — two completions per rep, even though the
                    // counter itself never moves. Covered by the repDispatch vectors,
                    // which fail on the slot at the exact frame.
                    if ev.atPeak { out.atPeak = ev }
                    else if ev.rejected { out.tooFast = ev }
                    else if ev.short { out.short = ev }
                    else { out.rep = ev }
                }
                out.reps = rc.display()
                out.state = rc.state
            }
        }

        // THE ONE CUE — worst offender, budget-limited, cooldown-limited.
        // NB: JS Array.sort is stable; Swift's is not guaranteed — sort by (s, index).
        var offenders = quality.enumerated()
            .filter { $0.element.cue != nil }
            .sorted { ($0.element.s, $0.offset) < ($1.element.s, $1.offset) }
            .map { $0.element }
        var viewDropped: [String] = []
        if out.viewLimited {
            func depth(_ r: Reading) -> Bool { r.target.m.k == "angle" && r.target.ideal < 168 }
            viewDropped = offenders.filter(depth).map { "view⊘" + ($0.cue ?? "") }
            offenders = offenders.filter { !depth($0) }
        }
        var unobserved: [String] = []
        for key in out.suppressed where !unobserved.contains(key) { unobserved.append(key) }
        suppressed = unobserved + viewDropped + offenders.dropFirst().compactMap { $0.cue }
        out.suppressed = suppressed

        // ── which parts to colour ──
        // Budget-suppressed faults still get colour (ambient, and speech is scarce).
        // View-suppressed ones do NOT: that reading isn't trustworthy at this angle,
        // and painting it would show an artefact of the camera position.
        var unreliable = Set<String>()
        if out.viewLimited {
            for r in out.readings where r.target.m.k == "angle" && r.target.ideal < 168 {
                unreliable.insert(r.target.id)
            }
        }
        // Only the pool the SCORE is built from, so the two channels agree; a limb
        // glowing red while the form bar reads 77 is a trust problem.
        let judged = quality.filter { r in
            !(r.target.pos ?? false) && !unreliable.contains(r.target.id) &&
            observations[r.target.id]!.sides.contains(frame.cam) &&
            ((!(r.target.gate ?? false) && (r.target.w ?? 1) > 0) ||
             ((r.target.gate ?? false) && r.s <= 0))
        }
        var worst: Reading? = nil
        for r in judged {
            let prev = sev[r.target.id] ?? 0
            var lvl = prev
            if r.s < TINT_IN[1] { lvl = 2 }
            else if r.s < TINT_IN[0] { lvl = max(1, (prev == 2 && r.s < TINT_OUT[1]) ? 2 : 1) }
            else if r.s > TINT_OUT[0] { lvl = 0 }
            else if prev == 2 && r.s > TINT_OUT[1] { lvl = 1 }
            sev[r.target.id] = lvl
            if lvl > 0 && (worst == nil || r.s < worst!.s) { worst = r }
        }
        // Learning shows ONE part, amber only — the tier that hides the numeric score
        // shouldn't shout in colour. Mirrors the one-cue budget.
        let solo = tier.cueBudget == 1
        var segs: [TintSeg] = []
        for r in judged {
            guard let lvl = sev[r.target.id], lvl > 0 else { continue }
            if solo, worst == nil || r.target.id != worst!.target.id { continue }
            let sv = solo ? 1 : lvl
            for (a, b) in tintSegs(r.target.m).segs {
                if let i = segs.firstIndex(where: { ($0.a == a && $0.b == b) || ($0.a == b && $0.b == a) }) {
                    segs[i] = TintSeg(a: segs[i].a, b: segs[i].b, sev: max(segs[i].sev, sv))
                } else {
                    segs.append(TintSeg(a: a, b: b, sev: sv))
                }
            }
        }
        out.tint = Tint(segs: segs, focus: worst.flatMap { tintSegs($0.target.m).focus })

        if let first = offenders.first, let key = first.cue {
            let isNew = !raised.contains(key)
            let budget = tier.cueBudget
            if isNew && raised.count >= budget {
                out.suppressed = [key] + out.suppressed
            } else if (now - lastCueAt) * 1000 >= tier.cueCool {
                lastCueAt = now
                raised.insert(key)
                corrections[key, default: 0] += 1
                if let a = armedAt {
                    log.append(LogEntry(key: key, at: ((now - a) * 10).rounded() / 10))
                }
                out.cue = key
            }
        }
        return out
    }

    /// The set actually STARTS — everything measured during setup is discarded.
    public func arm(now: Double?) {
        hold = 0; sum = 0; n = 0; score = 100
        raised.removeAll(); lastCueAt = -1e9; outOfPose = 0
        corrections = [:]
        log = []; scoreTrace = []; armedAt = now; lastTraceBucket = -1
        // arm() discards EVERYTHING measured during setup. Both of these were missed
        // when they were added later, so a set could open with a red limb and with
        // readings still smoothed from the shuffle into position (bug #18).
        sev = [:]
        ema = [:]
        scorePool = nil; driverSource = nil; targetSources = [:]
        if let rc = rep {
            rc.reps = 0; rc.state = "down"; rc.last = nil
            rc.base = nil; rc.primed = false; rc.pMax = 0
        }
    }

    public func avg() -> Int? { n > 0 ? Int((sum / Double(n)).rounded()) : nil }
    public func top() -> String? { corrections.max { $0.value < $1.value }?.key }
}

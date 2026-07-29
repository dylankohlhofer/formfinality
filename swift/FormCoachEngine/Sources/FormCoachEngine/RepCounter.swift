import Foundation

public struct RepEvent {
    public let n: Int
    public let peak: Double
    public let dur: Double?
    /// A rep the person performed but that was too fast to count. Reported, never
    /// swallowed: the coach teaches tempo instead of appearing to miss reps.
    public let rejected: Bool
    /// An attempt that left rest, got partway, and came back without reaching the
    /// threshold. No rep counts and the score drops, so it must be explained.
    public let short: Bool
    public let reached: Double
    /// ACKNOWLEDGEMENT, not accounting. Fired at the up-crossing, where the effort
    /// actually peaks — `n` is the rep the person is mid-way through, and `reps` has
    /// NOT yet moved. The cycle still completes on the return (hysteresis is what
    /// makes the count noise-proof); this only says "that landed" at the moment it
    /// landed. Beginner test 01: "it doesn't trigger until he lays back down, but it
    /// should be when he reaches the peak."
    public let atPeak: Bool
    public init(n: Int, peak: Double, dur: Double?, rejected: Bool = false,
                short: Bool = false, reached: Double = 0, atPeak: Bool = false) {
        self.n = n; self.peak = peak; self.dur = dur
        self.rejected = rejected; self.short = short; self.reached = reached
        self.atPeak = atPeak
    }
}

/// Exact mirror of the browser's Rep class — including PRIMING (nothing counts until a
/// genuine resting position has been seen; a plank is geometrically identical to a
/// bridge lockout) and the rest-only baseline drift guard (drifting during the rep
/// made slow, shallow reps uncountable — the beginner pattern).
public final class RepCounter {
    let s: RepSpec
    public var state = "down"
    public var reps = 0
    public var peak = 0.0
    public var last: Double? = nil
    public var base: Double? = nil
    public var durations: [Int] = []
    public var rushed = 0            // reps rejected on tempo
    public var short = 0             // attempts that never reached full range
    public var pMax = 0.0            // furthest progress toward the threshold this cycle
    public var primed = false

    public init(_ spec: RepSpec) { self.s = spec }

    public func update(_ v: Double, now: Double, dt: Double = REF_DT, minScale: Double = 1) -> RepEvent? {
        if s.baseline == true {
            if base == nil { base = v }
            else if state == "down", let b = base, abs(v - b) < 6 {
                base = b + emaAlpha(0.02, dt) * (v - b)
            }
        }
        let up: Double
        let down: Double
        if s.rising == true {
            up = s.upAbove ?? 0; down = s.downBelow ?? 0
        } else {
            let b = (s.baseline == true) ? (base ?? 0) : 0
            up = b + (s.upBelow ?? 0); down = b + (s.downAbove ?? 0)
        }

        if !primed {
            let atRest = (s.rising == true) ? v < down : v > down
            if !atRest { return nil }
            primed = true
        }

        if state == "down" {
            // Progress toward the threshold: 0 at rest, 1 at the threshold.
            let span = up - down
            let prog = span == 0 ? 0 : (v - down) / span
            pMax = max(pMax, prog)
            if (s.rising == true) ? v > up : v < up {
                // The CYCLE still completes on the return — but the user's effort
                // peaks HERE, so this is when they should be told it landed.
                // Acknowledgement and accounting are separate events (v4.9).
                state = "up"; peak = v; pMax = 0
                return RepEvent(n: reps + 1, peak: v, dur: nil, atPeak: true)
            }
            // SHORT RANGE — a property of the whole cycle, never of one frame. A
            // per-frame cue on the driver would fire at the bottom of every GOOD rep,
            // which is exactly the bug that shipped in glute-bridge (#16).
            if prog < 0.15 && pMax >= 0.4 && pMax < 1 {
                let reached = pMax; pMax = 0; short += 1
                return RepEvent(n: reps, peak: peak, dur: nil, short: true, reached: reached)
            }
            return nil
        }
        peak = (s.rising == true) ? max(peak, v) : min(peak, v)
        if (s.rising == true) ? v < down : v > down {
            let dur: Double? = last.map { (now - $0) * 1000 }
            // MINIMUM REP DURATION — declared in content since v4, enforced since v4.8.
            // Floor scales by tier (Strong 0.6x): a trained body may legitimately move
            // faster; a beginner is learning control.
            let floor = (s.minMs ?? 0) * minScale
            if let d = dur, floor > 0, d < floor {
                state = "down"; last = now; rushed += 1
                return RepEvent(n: reps, peak: peak, dur: dur, rejected: true)
            }
            state = "down"; reps += 1; pMax = 0
            last = now
            if let d = dur { durations.append(Int(d.rounded())) }
            return RepEvent(n: reps, peak: peak, dur: dur)
        }
        return nil
    }

    public func display() -> Int { Int((Double(reps) * (s.mult ?? 1)).rounded()) }
}

import Foundation

// 1:1 transcription of the v4.7 geometry. Every branch mirrors the JS, including
// the aspect correction (x is scaled by W/H so angles are PHYSICAL in any
// orientation) and the |dx| < 0.05 guard in line deviation.

struct Pt { let x: Double; let y: Double }

func angleAt(_ b: Pt, _ a: Pt, _ c: Pt) -> Double? {
    let v1 = Pt(x: a.x - b.x, y: a.y - b.y)
    let v2 = Pt(x: c.x - b.x, y: c.y - b.y)
    let dot = v1.x * v2.x + v1.y * v2.y
    let mag = (v1.x * v1.x + v1.y * v1.y).squareRoot() * (v2.x * v2.x + v2.y * v2.y).squareRoot()
    if mag < 1e-9 { return nil }
    return acos(max(-1, min(1, dot / mag))) * 180 / .pi
}

public func readMetric(_ m: MetricSpec, _ frame: PoseFrame, _ side: String) -> Double? {
    let P = frame.side(side)
    let A = frame.aspect ?? 1
    func g(_ name: String?) -> Joint? { name.flatMap { P[$0] } }

    switch m.k {
    case "angle":
        guard let b = g(m.v), let a = g(m.a), let c = g(m.c) else { return nil }
        return angleAt(Pt(x: b.x * A, y: b.y), Pt(x: a.x * A, y: a.y), Pt(x: c.x * A, y: c.y))
    case "line":
        guard let o = g(m.of), let f = g(m.from), let t = g(m.to) else { return nil }
        let dx = (t.x - f.x) * A
        if abs(dx) < 0.05 { return 0 }
        let u = ((o.x - f.x) * A) / dx
        return o.y - (f.y + u * (t.y - f.y))
    case "vert":
        guard let a = g(m.a), let b = g(m.b) else { return nil }
        return abs(atan2((b.x - a.x) * A, b.y - a.y) * 180 / .pi)
    default:
        return nil
    }
}

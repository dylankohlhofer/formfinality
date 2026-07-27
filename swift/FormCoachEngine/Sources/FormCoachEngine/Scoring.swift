import Foundation

// scoreTarget / cueFor — exact mirrors. `tierTol` is TIERS[tier].tol.

public func scoreTarget(_ t: PoseTarget, _ v: Double, tierTol: Double) -> Double {
    let tol = t.tol * tierTol
    let err = abs(v - t.ideal)
    if err <= tol { return 100 }
    let span = max(t.range - tol, 1e-4)
    return max(0, 100 * (1 - (err - tol) / span))
}

public func cueFor(_ t: PoseTarget, _ v: Double, tierTol: Double) -> String? {
    let tol = t.tol * tierTol
    if v < t.ideal - tol { return t.below }
    if v > t.ideal + tol { return t.above }
    return nil
}

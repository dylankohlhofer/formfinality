import Foundation

/// Frame-rate independence. Alphas are declared as "what this filter does in one
/// frame at 30fps" (matching the browser content), then converted per frame to the
/// time actually elapsed. Equivalent to a time-constant EMA, 1 - exp(-dt/tau), and
/// exactly the identity at dt == 1/30 — which is why the conformance vectors
/// (recorded at 30fps) still pass unchanged.
///
/// This matters far more on iOS than in the browser: frame rate varies by device,
/// thermal state and capture pipeline. Without it, a filter tuned at 30fps runs
/// ~3.7x faster at 90fps, and every threshold downstream inherits the error.
public let REF_DT: Double = 1.0 / 30.0

@inlinable
public func emaAlpha(_ alpha: Double, _ dt: Double) -> Double {
    guard dt > 0 else { return 0 }          // no time passed, no update
    if alpha >= 1 { return 1 }
    if dt == REF_DT { return alpha }        // exact, and skips the pow
    return 1 - pow(1 - alpha, dt / REF_DT)
}

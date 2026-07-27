import Foundation

/// Pure mirror of expandPlanSteps: {ex, t, sets:2} at Strong (setScale 1.5) becomes
/// set 1/3 → intra rest → set 2/3 → intra rest → set 3/3. Tier scaling applies ONLY
/// to steps that declare sets; a plain step is one set at every tier.
public func expandPlanSteps(_ steps: [PlanStep], tier: TierSpec) -> [PlanStep] {
    var out: [PlanStep] = []
    for st in steps {
        guard st.ex != nil else { out.append(st); continue }
        let total: Int
        if let sets = st.sets {
            total = max(1, Int((Double(sets) * (tier.setScale ?? 1)).rounded()))
        } else { total = 1 }
        for i in 1...total {
            out.append(PlanStep(ex: st.ex, t: st.t, sets: st.sets, setRest: st.setRest,
                                pre: st.pre, rest: st.rest, intra: st.intra,
                                setNo: i, setTotal: total))
            if i < total {
                out.append(PlanStep(rest: st.setRest ?? 15, intra: true))
            }
        }
    }
    return out
}

import Foundation

public struct ClipVars {
    public let t: Int?; public let p: String?; public let x: String?
    public init(t: Int? = nil, p: String? = nil, x: String? = nil) {
        self.t = t; self.p = p; self.x = x
    }
}

public func slugTok(_ t: String) -> String {
    var s = t.lowercased()
    s = s.map { ch -> Character in
        (ch.isLetter && ch.isASCII) || ch.isNumber ? ch : "-"
    }.reduce(into: "") { acc, ch in acc.append(ch) }
    while s.contains("--") { s = s.replacingOccurrences(of: "--", with: "-") }
    return s.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
}

/// Exact mirror of clipPlanFor — resolves a line to a clip sequence, or nil → TTS.
/// Numbers are PER-PERSONA (voice/<persona>/num/) with the legacy shared folder as
/// fallback, so a spliced number is always in the same voice as its sentence.
public func clipPlanFor(personaId: String, tierId: String, key: String, variant: Int,
                        vars: ClipVars, tmpl: String, has: (String) -> Bool) -> [String]? {
    func P(_ k: String, _ v: Int) -> String { "voice/\(personaId)/\(tierId)/\(k)_\(v).mp3" }
    func NUM(_ n: Int) -> String {
        let own = "voice/\(personaId)/num/\(n).mp3"
        return has(own) ? own : "voice/num/\(n).mp3"
    }
    func TOK(_ t: String) -> String { "voice/\(personaId)/tok/\(slugTok(t)).mp3" }

    var tokens: [String] = []
    var search = Substring(tmpl)
    while let r = search.range(of: "{") {
        let after = search[r.upperBound...]
        if let close = after.firstIndex(of: "}") {
            let tok = String(after[after.startIndex..<close])
            if tok == "t" || tok == "p" || tok == "x" { tokens.append("{\(tok)}") }
            search = after[after.index(after: close)...]
        } else { break }
    }

    if tokens.isEmpty {
        let base = P(key, variant)
        return has(base) ? [base] : nil
    }
    if tokens.count > 1 { return nil }

    let mid: String
    if tokens[0] == "{t}" {
        guard let t = vars.t else { return nil }
        mid = NUM(t)
    } else {
        guard let val = (tokens[0] == "{p}" ? vars.p : vars.x) else { return nil }
        mid = TOK(val)
    }
    if !has(mid) { return nil }

    let seq = [P(key + ".a", variant), mid, P(key + ".b", variant)]
        .filter { $0 == mid || has($0) }
    return seq.isEmpty ? nil : seq
}

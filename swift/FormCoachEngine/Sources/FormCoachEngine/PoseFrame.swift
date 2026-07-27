import Foundation

public struct Joint: Codable {
    public let x: Double
    public let y: Double
    public var z: Double?
    public let c: Double
    public init(x: Double, y: Double, z: Double? = nil, c: Double) {
        self.x = x; self.y = y; self.z = z; self.c = c
    }
}

public typealias SideJoints = [String: Joint]

/// The engine's only input. Pure data — no Vision, no MediaPipe types.
public struct PoseFrame {
    public var left: SideJoints
    public var right: SideJoints
    public var cam: String               // "left" | "right"
    public var conf: Double
    public var aspect: Double?           // image W/H — restores physical angles
    public var sideness: Double?         // 90 = side-on, 0 = facing; nil = unknown
    public init(left: SideJoints, right: SideJoints, cam: String, conf: Double,
                aspect: Double? = nil, sideness: Double? = nil) {
        self.left = left; self.right = right; self.cam = cam; self.conf = conf
        self.aspect = aspect; self.sideness = sideness
    }
    public func side(_ s: String) -> SideJoints { s == "right" ? right : left }
}

import type { Grid } from './grid.ts'
import type { SpringSet } from './springs.ts'

/**
 * Mesafe kısıtı (Jakobsen / PBD):
 *   Δ = (l − L0)/l · d
 *   x_a += w_a/(w_a+w_b) · s · Δ,   x_b −= w_b/(w_a+w_b) · s · Δ
 */
export function satisfySprings(g: Grid, s: SpringSet, stiffness: number) {
  const { pos, invMass } = g
  const { pairs, rest } = s
  for (let j = 0; j < s.count; j++) {
    const ia = pairs[2 * j]
    const ib = pairs[2 * j + 1]
    const wa = invMass[ia]
    const wb = invMass[ib]
    const w = wa + wb
    if (w === 0) continue
    const a = 3 * ia
    const b = 3 * ib
    const dx = pos[b] - pos[a]
    const dy = pos[b + 1] - pos[a + 1]
    const dz = pos[b + 2] - pos[a + 2]
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (l < 1e-9) continue
    const c = (stiffness * (l - rest[j])) / (l * w)
    pos[a] += wa * c * dx
    pos[a + 1] += wa * c * dy
    pos[a + 2] += wa * c * dz
    pos[b] -= wb * c * dx
    pos[b + 1] -= wb * c * dy
    pos[b + 2] -= wb * c * dz
  }
}

export interface Colliders {
  ground: { enabled: boolean; y: number }
  sphere: { enabled: boolean; x: number; y: number; z: number; r: number }
  /** 0 → kaygan, 1 → yapışkan */
  friction: number
}

const SKIN = 0.01

/** Zemin ve küre çarpışması: parçacık yüzeyin dışına itilir, teğetsel hız sürtünmeyle azaltılır. */
export function collide(g: Grid, col: Colliders) {
  const { pos, prev, invMass } = g
  const f = col.friction
  const sp = col.sphere
  const r = sp.r + SKIN
  for (let i = 0; i < g.count; i++) {
    if (invMass[i] === 0) continue
    const p = 3 * i
    if (col.ground.enabled && pos[p + 1] < col.ground.y + SKIN) {
      pos[p + 1] = col.ground.y + SKIN
      prev[p] += (pos[p] - prev[p]) * f
      prev[p + 2] += (pos[p + 2] - prev[p + 2]) * f
    }
    if (sp.enabled) {
      const dx = pos[p] - sp.x
      const dy = pos[p + 1] - sp.y
      const dz = pos[p + 2] - sp.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < r && d > 1e-9) {
        const s = r / d
        pos[p] = sp.x + dx * s
        pos[p + 1] = sp.y + dy * s
        pos[p + 2] = sp.z + dz * s
        for (let k = 0; k < 3; k++) prev[p + k] += (pos[p + k] - prev[p + k]) * f
      }
    }
  }
}

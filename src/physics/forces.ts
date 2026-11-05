import type { Grid } from './grid.ts'
import type { SpringSet } from './springs.ts'

export interface Wind {
  x: number
  y: number
  z: number
  /** 0 → sabit rüzgâr, 1 → güçlü dalgalanma */
  turbulence: number
  /** Aerodinamik katsayı (½·ρ·C) [kg/m³] */
  drag: number
}

/**
 * Hooke yayı + yay boyunca sönüm. Kuvvetler `force` dizisine eklenir.
 *   F_a = ( k (l − L0) + kd ((v_b − v_a)·u) ) u,   F_b = −F_a
 * Verlet'te hız örtüktür: v ≈ (x − x_prev) / Δt.
 */
export function addSpringForces(g: Grid, s: SpringSet, k: number, kd: number, dt: number, force: Float32Array) {
  const { pos, prev } = g
  const { pairs, rest, alive } = s
  const invDt = 1 / dt
  for (let j = 0; j < s.count; j++) {
    if (!alive[j]) continue
    const a = 3 * pairs[2 * j]
    const b = 3 * pairs[2 * j + 1]
    const dx = pos[b] - pos[a]
    const dy = pos[b + 1] - pos[a + 1]
    const dz = pos[b + 2] - pos[a + 2]
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (l < 1e-9) continue
    const ux = dx / l
    const uy = dy / l
    const uz = dz / l
    const rvx = (pos[b] - prev[b] - (pos[a] - prev[a])) * invDt
    const rvy = (pos[b + 1] - prev[b + 1] - (pos[a + 1] - prev[a + 1])) * invDt
    const rvz = (pos[b + 2] - prev[b + 2] - (pos[a + 2] - prev[a + 2])) * invDt
    const f = k * (l - rest[j]) + kd * (rvx * ux + rvy * uy + rvz * uz)
    force[a] += f * ux
    force[a + 1] += f * uy
    force[a + 2] += f * uz
    force[b] -= f * ux
    force[b + 1] -= f * uy
    force[b + 2] -= f * uz
  }
}

/**
 * Üçgen başına rüzgâr: F = c · (N·v_rel) · N / (2|N|),  N = e1 × e2 (|N| = 2A).
 * Kuvvet üçgenin üç köşesine eşit dağıtılır.
 */
export function addWindForces(g: Grid, index: Uint32Array, wind: Wind, time: number, dt: number, force: Float32Array) {
  const { pos, prev } = g
  const invDt = 1 / dt
  const t = wind.turbulence
  for (let k = 0; k < index.length; k += 3) {
    const a = 3 * index[k]
    const b = 3 * index[k + 1]
    const c = 3 * index[k + 2]
    const e1x = pos[b] - pos[a]
    const e1y = pos[b + 1] - pos[a + 1]
    const e1z = pos[b + 2] - pos[a + 2]
    const e2x = pos[c] - pos[a]
    const e2y = pos[c + 1] - pos[a + 1]
    const e2z = pos[c + 2] - pos[a + 2]
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (nl < 1e-12) continue
    // Konuma ve zamana bağlı ucuz dalgalanma
    const cx = (pos[a] + pos[b] + pos[c]) / 3
    const cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3
    const gust = 1 + t * Math.sin(time * 2.1 + cx * 1.7) * Math.cos(time * 1.3 + cy * 2.3)
    const vx = (pos[a] - prev[a] + pos[b] - prev[b] + pos[c] - prev[c]) * invDt / 3
    const vy = (pos[a + 1] - prev[a + 1] + pos[b + 1] - prev[b + 1] + pos[c + 1] - prev[c + 1]) * invDt / 3
    const vz = (pos[a + 2] - prev[a + 2] + pos[b + 2] - prev[b + 2] + pos[c + 2] - prev[c + 2]) * invDt / 3
    const rx = wind.x * gust - vx
    const ry = wind.y * gust - vy
    const rz = wind.z * gust - vz
    const s = (wind.drag * (nx * rx + ny * ry + nz * rz)) / (2 * nl) / 3
    for (const p of [a, b, c]) {
      force[p] += s * nx
      force[p + 1] += s * ny
      force[p + 2] += s * nz
    }
  }
}

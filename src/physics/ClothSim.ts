import { collide, satisfySprings, type Colliders } from './constraints.ts'
import { addSpringForces, addWindForces, type Wind } from './forces.ts'
import { createGrid, type Grid, type GridSpec } from './grid.ts'
import { SPRING_KINDS, createSprings, type SpringKind, type SpringSet } from './springs.ts'

export type Solver = 'force' | 'pbd'

export interface SpringParams {
  enabled: boolean
  /** Kuvvet modu: yay sabiti [N/m] */
  k: number
  /** Kuvvet modu: yay sönümü [N·s/m] */
  kd: number
  /** Kısıt modu: düzeltme oranı [0, 1] */
  stiffness: number
}

export interface SolverParams {
  solver: Solver
  /** Sabit fizik adımı [s] */
  dt: number
  /** Kısıt modu: kare başına yay düzeltme yinelemesi */
  iterations: number
  /** Hava sürtünmesi (Verlet hız sönümü), adım başına */
  damping: number
  gravity: number
  springs: Record<SpringKind, SpringParams>
  wind: Wind
  colliders: Colliders
}

export interface ClothParams extends GridSpec, SolverParams {}

export interface ClothStats {
  time: number
  steps: number
  kinetic: number
  potential: number
  springEnergy: number
  /** Structural yaylardaki en büyük uzama oranı (l − L0)/L0 */
  maxStretch: number
  exploded: boolean
}

const MAX_STEPS_PER_ADVANCE = 2000

export class ClothSim {
  grid: Grid
  springs: Record<SpringKind, SpringSet>
  params: ClothParams
  time = 0
  steps = 0
  exploded = false
  private force: Float32Array
  private accumulator = 0
  private grabbed = -1
  private grabbedInvMass = 0
  private grabTarget = [0, 0, 0]

  constructor(params: ClothParams) {
    this.params = params
    this.grid = createGrid(params)
    this.springs = Object.fromEntries(
      SPRING_KINDS.map((k) => [k, createSprings(k, params.n, params.m, this.grid.pos)]),
    ) as Record<SpringKind, SpringSet>
    this.force = new Float32Array(3 * this.grid.count)
  }

  /** Kare süresi kadar ilerle; fizik her zaman sabit `dt` ile adımlanır. */
  advance(frameDt: number) {
    if (this.exploded) return 0
    const dt = this.params.dt
    this.accumulator += Math.min(frameDt, 0.1)
    let n = 0
    while (this.accumulator >= dt && n < MAX_STEPS_PER_ADVANCE) {
      this.step()
      this.accumulator -= dt
      n++
    }
    if (n === MAX_STEPS_PER_ADVANCE) this.accumulator = 0
    return n
  }

  step() {
    const p = this.params
    const g = this.grid
    const { pos, prev, invMass } = g
    const dt = p.dt
    const dt2 = dt * dt
    const force = this.force
    force.fill(0)

    if (p.wind.drag > 0 && (p.wind.x !== 0 || p.wind.y !== 0 || p.wind.z !== 0)) {
      addWindForces(g, p.wind, this.time, dt, force)
    }
    if (p.solver === 'force') {
      for (const kind of SPRING_KINDS) {
        const sp = p.springs[kind]
        if (sp.enabled) addSpringForces(g, this.springs[kind], sp.k, sp.kd, dt, force)
      }
    }

    // Konum Verlet:  x' = x + (x − x_prev)(1 − c) + a·Δt²
    const keep = 1 - p.damping
    for (let i = 0; i < g.count; i++) {
      const w = invMass[i]
      const j = 3 * i
      if (w === 0) {
        prev[j] = pos[j]
        prev[j + 1] = pos[j + 1]
        prev[j + 2] = pos[j + 2]
        continue
      }
      for (let k = 0; k < 3; k++) {
        const x = pos[j + k]
        const a = force[j + k] * w - (k === 1 ? p.gravity : 0)
        pos[j + k] = x + (x - prev[j + k]) * keep + a * dt2
        prev[j + k] = x
      }
    }

    if (this.grabbed >= 0) this.applyGrab()

    if (p.solver === 'pbd') {
      for (let it = 0; it < p.iterations; it++) {
        for (const kind of SPRING_KINDS) {
          const sp = p.springs[kind]
          if (sp.enabled) satisfySprings(g, this.springs[kind], sp.stiffness)
        }
        collide(g, p.colliders)
      }
    } else {
      collide(g, p.colliders)
    }

    this.time += dt
    this.steps++
    if (!Number.isFinite(pos[0]) || !Number.isFinite(pos[pos.length - 1])) this.exploded = true
  }

  // ---- Etkileşim ----

  grab(i: number, target: [number, number, number]) {
    if (this.grabbed !== i) {
      this.release()
      this.grabbed = i
      this.grabbedInvMass = this.grid.invMass[i]
      this.grid.invMass[i] = 0
    }
    this.grabTarget = target
  }

  moveGrab(target: [number, number, number]) {
    this.grabTarget = target
  }

  release() {
    if (this.grabbed < 0) return
    this.grid.invMass[this.grabbed] = this.grabbedInvMass
    this.grabbed = -1
  }

  get grabbedIndex() {
    return this.grabbed
  }

  /** Duraklatılmışken sürüklenen parçacığı adım atmadan hedefe taşı. */
  holdGrab() {
    if (this.grabbed < 0) return
    const j = 3 * this.grabbed
    for (let k = 0; k < 3; k++) this.grid.pos[j + k] = this.grid.prev[j + k] = this.grabTarget[k]
  }

  togglePin(i: number) {
    const g = this.grid
    if (i === this.grabbed) {
      this.grabbedInvMass = this.grabbedInvMass === 0 ? g.baseInvMass : 0
    } else {
      g.invMass[i] = g.invMass[i] === 0 ? g.baseInvMass : 0
    }
  }

  isPinned(i: number) {
    return (i === this.grabbed ? this.grabbedInvMass : this.grid.invMass[i]) === 0
  }

  private applyGrab() {
    const j = 3 * this.grabbed
    const { pos, prev } = this.grid
    for (let k = 0; k < 3; k++) {
      prev[j + k] = pos[j + k]
      pos[j + k] = this.grabTarget[k]
    }
  }

  // ---- Ölçümler ----

  stats(): ClothStats {
    const p = this.params
    const { pos, prev, invMass, particleMass, count } = this.grid
    const invDt = 1 / p.dt
    let kinetic = 0
    let potential = 0
    for (let i = 0; i < count; i++) {
      const j = 3 * i
      potential += particleMass * p.gravity * pos[j + 1]
      if (invMass[i] === 0) continue
      const vx = (pos[j] - prev[j]) * invDt
      const vy = (pos[j + 1] - prev[j + 1]) * invDt
      const vz = (pos[j + 2] - prev[j + 2]) * invDt
      kinetic += 0.5 * particleMass * (vx * vx + vy * vy + vz * vz)
    }
    let springEnergy = 0
    for (const kind of SPRING_KINDS) {
      const sp = p.springs[kind]
      if (!sp.enabled || p.solver !== 'force') continue
      const s = this.springs[kind]
      for (let j = 0; j < s.count; j++) {
        const e = this.springLength(s, j) - s.rest[j]
        springEnergy += 0.5 * sp.k * e * e
      }
    }
    let maxStretch = 0
    const st = this.springs.structural
    for (let j = 0; j < st.count; j++) {
      maxStretch = Math.max(maxStretch, (this.springLength(st, j) - st.rest[j]) / st.rest[j])
    }
    return { time: this.time, steps: this.steps, kinetic, potential, springEnergy, maxStretch, exploded: this.exploded }
  }

  springLength(s: SpringSet, j: number) {
    const pos = this.grid.pos
    const a = 3 * s.pairs[2 * j]
    const b = 3 * s.pairs[2 * j + 1]
    return Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2])
  }

  /**
   * Kuvvet modunda kararlılık için kaba üst sınır.
   * Verlet ω·Δt < 2 ister; zincir benzeri ızgarada ω²_max ≈ 4·Σk / m
   *   ⇒ Δt_kritik ≈ √(m / Σk)
   */
  criticalDt() {
    let kSum = 0
    for (const kind of SPRING_KINDS) {
      const sp = this.params.springs[kind]
      if (sp.enabled) kSum += sp.k
    }
    return kSum > 0 ? Math.sqrt(this.grid.particleMass / kSum) : Infinity
  }
}

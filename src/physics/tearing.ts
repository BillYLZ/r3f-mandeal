import type { Grid } from './grid.ts'
import type { SpringKind, SpringSet } from './springs.ts'

/**
 * Yırtılma topolojisi.
 *
 * Izgaranın her hücresi (x,y)–(x+1,y+1) iki üçgenden oluşur ve 6 yaya dayanır:
 * 4 structural kenar + 2 shear köşegen. Kurallar:
 *  1. Structural veya shear yay (l − L0)/L0 > eşik olunca kopar (ya da bıçakla kesilir).
 *  2. Yaylarından biri kopan hücre ölür: iki üçgeni mesh'ten silinir, iki köşegeni de kopar.
 *  3. Her iki yanındaki hücre ölmüş structural kenar da kopar (havada kalan iplik bırakmaz).
 *  4. Bending yayı, üzerinden geçtiği iki structural yaydan biri koptuysa kopar.
 */
export class TearMap {
  readonly cells: number
  /** Hücre başına [üst, alt, sol, sağ] structural ve [a–d, b–c] shear yay indeksleri */
  private cellStruct: Int32Array
  private cellShear: Int32Array
  /** Structural yay başına en çok iki komşu hücre (−1: yok) */
  private structCells: Int32Array
  /** Bending yay başına üzerinden geçtiği iki structural yay */
  private bendHalves: Int32Array
  cellAlive: Uint8Array
  /** Yalnızca canlı hücrelerin üçgenleri */
  index: Uint32Array
  /** Topoloji her değiştiğinde artar (mesh indeksini yenilemek için) */
  version = 0
  /** Kopan structural + shear yay sayısı */
  torn = 0

  private grid: Grid
  private springs: Record<SpringKind, SpringSet>

  constructor(grid: Grid, springs: Record<SpringKind, SpringSet>) {
    this.grid = grid
    this.springs = springs
    const { n, m, count } = grid
    const key = (a: number, b: number) => Math.min(a, b) * count + Math.max(a, b)
    const lookup = (s: SpringSet) => {
      const map = new Map<number, number>()
      for (let j = 0; j < s.count; j++) map.set(key(s.pairs[2 * j], s.pairs[2 * j + 1]), j)
      return (a: number, b: number) => map.get(key(a, b)) ?? -1
    }
    const st = lookup(springs.structural)
    const sh = lookup(springs.shear)

    this.cells = Math.max(0, (n - 1) * (m - 1))
    this.cellStruct = new Int32Array(4 * this.cells)
    this.cellShear = new Int32Array(2 * this.cells)
    this.structCells = new Int32Array(2 * springs.structural.count).fill(-1)
    for (let y = 0; y < m - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = y * (n - 1) + x
        const a = y * n + x
        const b = a + 1
        const d = a + n
        const e = d + 1
        const edges = [st(a, b), st(d, e), st(a, d), st(b, e)]
        this.cellStruct.set(edges, 4 * c)
        this.cellShear.set([sh(a, e), sh(b, d)], 2 * c)
        for (const s of edges) {
          const slot = this.structCells[2 * s] < 0 ? 2 * s : 2 * s + 1
          this.structCells[slot] = c
        }
      }
    }

    const bend = springs.bending
    this.bendHalves = new Int32Array(2 * bend.count)
    for (let j = 0; j < bend.count; j++) {
      const a = bend.pairs[2 * j]
      const b = bend.pairs[2 * j + 1]
      const mid = (a + b) / 2
      this.bendHalves[2 * j] = st(a, mid)
      this.bendHalves[2 * j + 1] = st(mid, b)
    }

    this.cellAlive = new Uint8Array(this.cells).fill(1)
    this.index = grid.index
  }

  /** Eşiği aşan yayları kopar. Topoloji değiştiyse true döner. */
  tearOverstretched(threshold: number) {
    let changed = false
    for (const kind of ['structural', 'shear'] as const) {
      const s = this.springs[kind]
      const limit = 1 + threshold
      for (let j = 0; j < s.count; j++) {
        if (!s.alive[j]) continue
        if (this.length(s, j) > limit * s.rest[j]) {
          s.alive[j] = 0
          changed = true
        }
      }
    }
    if (changed) this.propagate()
    return changed
  }

  /** Orta noktası `p` merkezli `r` yarıçaplı kürenin içinde kalan yayları kes. */
  cut(p: [number, number, number], r: number) {
    const pos = this.grid.pos
    const r2 = r * r
    let changed = false
    for (const kind of ['structural', 'shear'] as const) {
      const s = this.springs[kind]
      for (let j = 0; j < s.count; j++) {
        if (!s.alive[j]) continue
        const a = 3 * s.pairs[2 * j]
        const b = 3 * s.pairs[2 * j + 1]
        const dx = (pos[a] + pos[b]) / 2 - p[0]
        const dy = (pos[a + 1] + pos[b + 1]) / 2 - p[1]
        const dz = (pos[a + 2] + pos[b + 2]) / 2 - p[2]
        if (dx * dx + dy * dy + dz * dz < r2) {
          s.alive[j] = 0
          changed = true
        }
      }
    }
    if (changed) this.propagate()
    return changed
  }

  private propagate() {
    const { structural: st, shear: sh, bending: bd } = this.springs
    // 2) Yayı kopan hücreler ölür, köşegenleri de kopar
    for (let c = 0; c < this.cells; c++) {
      if (!this.cellAlive[c]) continue
      let dead = false
      for (let k = 0; k < 4 && !dead; k++) dead = !st.alive[this.cellStruct[4 * c + k]]
      for (let k = 0; k < 2 && !dead; k++) dead = !sh.alive[this.cellShear[2 * c + k]]
      if (!dead) continue
      this.cellAlive[c] = 0
      sh.alive[this.cellShear[2 * c]] = 0
      sh.alive[this.cellShear[2 * c + 1]] = 0
    }
    // 3) Bütün komşu hücreleri ölmüş structural kenarlar kopar
    if (this.cells > 0) {
      for (let j = 0; j < st.count; j++) {
        if (!st.alive[j]) continue
        const c0 = this.structCells[2 * j]
        const c1 = this.structCells[2 * j + 1]
        if ((c0 < 0 || !this.cellAlive[c0]) && (c1 < 0 || !this.cellAlive[c1])) st.alive[j] = 0
      }
    }
    // 4) Bending yayları, altındaki structural yaylardan biri koptuysa kopar
    for (let j = 0; j < bd.count; j++) {
      if (bd.alive[j] && (!st.alive[this.bendHalves[2 * j]] || !st.alive[this.bendHalves[2 * j + 1]])) bd.alive[j] = 0
    }

    // Mesh indeksi: canlı hücrelerin üçgenleri (grid.index hücre sırasıyla 6'şar indeks içerir)
    let alive = 0
    for (let c = 0; c < this.cells; c++) alive += this.cellAlive[c]
    const out = new Uint32Array(6 * alive)
    let k = 0
    for (let c = 0; c < this.cells; c++) {
      if (!this.cellAlive[c]) continue
      out.set(this.grid.index.subarray(6 * c, 6 * c + 6), k)
      k += 6
    }
    this.index = out
    this.torn = 0
    for (const s of [st, sh]) for (let j = 0; j < s.count; j++) this.torn += 1 - s.alive[j]
    this.version++
  }

  private length(s: SpringSet, j: number) {
    const pos = this.grid.pos
    const a = 3 * s.pairs[2 * j]
    const b = 3 * s.pairs[2 * j + 1]
    return Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2])
  }
}

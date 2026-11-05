/**
 * Yay üretimi. Üç tür:
 *  - structural: (1,0), (0,1)   → gerilmeye direnç
 *  - shear:      (1,1), (1,−1)  → kaymaya direnç
 *  - bending:    (2,0), (0,2)   → bükülmeye direnç
 */
export type SpringKind = 'structural' | 'shear' | 'bending'
export const SPRING_KINDS: SpringKind[] = ['structural', 'shear', 'bending']

export const OFFSETS: Record<SpringKind, [number, number][]> = {
  structural: [
    [1, 0],
    [0, 1],
  ],
  shear: [
    [1, 1],
    [1, -1],
  ],
  bending: [
    [2, 0],
    [0, 2],
  ],
}

export interface SpringSet {
  kind: SpringKind
  count: number
  /** [a0, b0, a1, b1, ...] */
  pairs: Uint32Array
  rest: Float32Array
  /** 1 → sağlam, 0 → kopmuş (yırtılma) */
  alive: Uint8Array
}

/** Formülle beklenen yay sayısı (testler ve HUD için). */
export function expectedSpringCount(kind: SpringKind, n: number, m: number) {
  const p = (v: number) => Math.max(0, v)
  switch (kind) {
    case 'structural':
      return p(n - 1) * m + n * p(m - 1)
    case 'shear':
      return 2 * p(n - 1) * p(m - 1)
    case 'bending':
      return p(n - 2) * m + n * p(m - 2)
  }
}

export function createSprings(kind: SpringKind, n: number, m: number, pos: Float32Array): SpringSet {
  const pairs: number[] = []
  for (let y = 0; y < m; y++) {
    for (let x = 0; x < n; x++) {
      for (const [ox, oy] of OFFSETS[kind]) {
        const x2 = x + ox
        const y2 = y + oy
        if (x2 < 0 || x2 >= n || y2 < 0 || y2 >= m) continue
        pairs.push(y * n + x, y2 * n + x2)
      }
    }
  }
  const count = pairs.length / 2
  const rest = new Float32Array(count)
  for (let s = 0; s < count; s++) {
    const a = 3 * pairs[2 * s]
    const b = 3 * pairs[2 * s + 1]
    rest[s] = Math.hypot(pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2])
  }
  return { kind, count, pairs: Uint32Array.from(pairs), rest, alive: new Uint8Array(count).fill(1) }
}

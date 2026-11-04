/**
 * n × m parçacık ızgarası. Parçacık indeksi: i = y·n + x (y = 0 üst satır).
 * Struct-of-Arrays düzeni: konum dizisi doğrudan BufferGeometry'ye kopyalanabilir.
 */
export type Orientation = 'vertical' | 'horizontal'
export type PinMode = 'top' | 'corners' | 'left' | 'leftright' | 'none'

export interface GridSpec {
  n: number
  m: number
  width: number
  height: number
  /** Toplam kütle [kg]; parçacıklara eşit dağıtılır. */
  mass: number
  orientation: Orientation
  pin: PinMode
  /** Dikey: üst kenarın yüksekliği. Yatay: kumaş düzleminin yüksekliği [m]. */
  elevation: number
}

export interface Grid {
  n: number
  m: number
  count: number
  pos: Float32Array
  prev: Float32Array
  /** Ters kütle; 0 → sabitlenmiş */
  invMass: Float32Array
  /** Sabitlenmemiş haldeki ters kütle (pin açıp kapatmak için) */
  baseInvMass: number
  particleMass: number
  uv: Float32Array
  index: Uint32Array
}

export function isPinned(pin: PinMode, x: number, y: number, n: number, m: number) {
  switch (pin) {
    case 'top':
      return y === 0
    case 'corners':
      return y === 0 && (x === 0 || x === n - 1)
    case 'left':
      return x === 0
    case 'leftright':
      return x === 0 || x === n - 1
    case 'none':
      return false
  }
}

export function createGrid(s: GridSpec): Grid {
  const { n, m } = s
  const count = n * m
  const pos = new Float32Array(3 * count)
  const uv = new Float32Array(2 * count)
  const invMass = new Float32Array(count)
  const particleMass = s.mass / count
  const baseInvMass = 1 / particleMass
  const dx = n > 1 ? s.width / (n - 1) : 0
  const dy = m > 1 ? s.height / (m - 1) : 0

  for (let y = 0; y < m; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const px = -s.width / 2 + x * dx
      if (s.orientation === 'vertical') {
        pos[3 * i] = px
        pos[3 * i + 1] = s.elevation - y * dy
        pos[3 * i + 2] = 0
      } else {
        pos[3 * i] = px
        pos[3 * i + 1] = s.elevation
        pos[3 * i + 2] = -s.height / 2 + y * dy
      }
      uv[2 * i] = n > 1 ? x / (n - 1) : 0
      uv[2 * i + 1] = m > 1 ? 1 - y / (m - 1) : 0
      invMass[i] = isPinned(s.pin, x, y, n, m) ? 0 : baseInvMass
    }
  }

  // Her kare iki üçgen; köşegen yönü dama tahtası gibi değişir (simetrik kırışma)
  const index = new Uint32Array(Math.max(0, 6 * (n - 1) * (m - 1)))
  let k = 0
  for (let y = 0; y < m - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = y * n + x
      const b = a + 1
      const c = a + n
      const d = c + 1
      if ((x + y) % 2 === 0) {
        index.set([a, c, b, b, c, d], k)
      } else {
        index.set([a, c, d, a, d, b], k)
      }
      k += 6
    }
  }

  return { n, m, count, pos, prev: pos.slice(), invMass, baseInvMass, particleMass, uv, index }
}

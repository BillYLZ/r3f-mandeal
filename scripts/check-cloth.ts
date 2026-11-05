import { ClothSim, type ClothParams } from '../src/physics/ClothSim.ts'
import { DEFAULT_PARAMS } from '../src/physics/presets.ts'
import { SPRING_KINDS, expectedSpringCount } from '../src/physics/springs.ts'

let failed = false
function check(ok: boolean, msg: string) {
  console.log(`${ok ? '✓' : '✗'} ${msg}`)
  if (!ok) failed = true
}

const clone = (p: ClothParams): ClothParams => structuredClone(p)
const make = (over: (p: ClothParams) => void) => {
  const p = clone(DEFAULT_PARAMS)
  over(p)
  return new ClothSim(p)
}
const noColliders = (p: ClothParams) => {
  p.colliders.ground.enabled = false
  p.colliders.sphere.enabled = false
}

// 1) Yay sayıları
{
  const sim = make((p) => {
    p.n = 10
    p.m = 10
  })
  const got = SPRING_KINDS.map((k) => sim.springs[k].count)
  check(got.join('/') === '180/162/160', `10×10 yay sayıları ${got.join(' / ')} (beklenen 180 / 162 / 160)`)
  for (const [n, m] of [
    [2, 2],
    [7, 3],
    [40, 25],
  ]) {
    const s = make((p) => {
      p.n = n
      p.m = m
    })
    check(
      SPRING_KINDS.every((k) => s.springs[k].count === expectedSpringCount(k, n, m)),
      `${n}×${m} yay sayıları formülle eşleşiyor`,
    )
  }
}

// 2) Yerçekimsiz, dinlenme halindeki kumaş hareketsiz kalır (iki çözücü)
for (const solver of ['pbd', 'force'] as const) {
  const sim = make((p) => {
    p.solver = solver
    p.dt = solver === 'force' ? 1 / 2000 : 1 / 240
    p.gravity = 0
    p.pin = 'none'
    noColliders(p)
  })
  const start = sim.grid.pos.slice()
  sim.advance(1)
  let maxD = 0
  for (let i = 0; i < start.length; i++) maxD = Math.max(maxD, Math.abs(sim.grid.pos[i] - start[i]))
  check(maxD < 1e-5, `${solver}: dinlenme durumu korunuyor (en büyük kayma ${maxD.toExponential(1)} m)`)
}

// 3) Serbest düşüş ½·g·t²
{
  const sim = make((p) => {
    p.n = 2
    p.m = 2
    p.pin = 'none'
    p.damping = 0
    p.wind.x = 0
    noColliders(p)
    for (const k of SPRING_KINDS) p.springs[k].enabled = false
  })
  const y0 = sim.grid.pos[1]
  const T = 1
  const N = Math.round(T / sim.params.dt)
  for (let i = 0; i < N; i++) sim.step()
  const drop = y0 - sim.grid.pos[1]
  const expected = 0.5 * 9.81 * T * T
  check(Math.abs(drop - expected) / expected < 0.01, `serbest düşüş 1 s: ${drop.toFixed(4)} m (½gt² = ${expected.toFixed(4)} m)`)
}

// 4) Tek yay–kütle salınımı: T = 2π√(m/k)
{
  const k = 50
  const sim = make((p) => {
    p.n = 2
    p.m = 1
    p.mass = 0.2 // parçacık başına 0,1 kg
    p.pin = 'left'
    p.solver = 'force'
    p.dt = 1 / 5000
    p.gravity = 0
    p.damping = 0
    noColliders(p)
    p.springs.structural = { enabled: true, k, kd: 0, stiffness: 1 }
  })
  const rest = sim.springs.structural.rest[0]
  const g = sim.grid
  g.pos[3] += 0.1 * rest
  g.prev[3] = g.pos[3]
  const x0 = g.pos[0] + rest
  const crossings: number[] = []
  let last = g.pos[3] - x0
  for (let i = 0; i < 5 * 5000; i++) {
    sim.step()
    const cur = g.pos[3] - x0
    if (last > 0 && cur <= 0) crossings.push(sim.time)
    last = cur
  }
  const period = (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1)
  const expected = 2 * Math.PI * Math.sqrt(g.particleMass / k)
  check(Math.abs(period - expected) / expected < 0.005, `yay periyodu ${period.toFixed(4)} s (2π√(m/k) = ${expected.toFixed(4)} s)`)
}

// 5) Enerji: sönümsüzde korunur, sönümlüde azalır (kuvvet modu)
for (const damped of [false, true]) {
  const sim = make((p) => {
    p.n = 12
    p.m = 12
    p.solver = 'force'
    p.dt = 1 / 4000
    p.gravity = 0
    p.pin = 'none'
    p.damping = 0
    noColliders(p)
    for (const k of SPRING_KINDS) p.springs[k].kd = damped ? p.springs[k].kd : 0
  })
  // Ortadaki parçacığı dışarı çek
  const mid = 3 * (6 * 12 + 6)
  sim.grid.pos[mid + 2] += 0.05
  sim.grid.prev[mid + 2] = sim.grid.pos[mid + 2]
  const total = () => {
    const s = sim.stats()
    return s.kinetic + s.springEnergy
  }
  const e0 = total()
  let maxDev = 0
  for (let i = 0; i < 8000; i++) {
    sim.step()
    if (i % 100 === 0) maxDev = Math.max(maxDev, Math.abs(total() - e0) / e0)
  }
  const e1 = total()
  if (damped) check(e1 < 0.5 * e0, `sönümlü: enerji ${e0.toExponential(2)} → ${e1.toExponential(2)} J azaldı`)
  else check(maxDev < 0.05, `sönümsüz: enerji sapması en çok %${(maxDev * 100).toFixed(2)}`)
}

// 6) Pin'ler yerinde kalır, kumaş sarkar
{
  const sim = make((p) => (p.pin = 'top'))
  const top = sim.grid.pos.slice(0, 3 * sim.grid.n)
  const yBottom0 = sim.grid.pos[sim.grid.pos.length - 2]
  for (let i = 0; i < 120; i++) sim.advance(1 / 60)
  const moved = top.some((v, i) => v !== sim.grid.pos[i])
  check(!moved, 'üst kenar sabit kaldı')
  const st = sim.stats()
  check(st.maxStretch < 0.05, `PBD: en büyük uzama %${(st.maxStretch * 100).toFixed(2)} (< %5)`)
  check(Math.abs(sim.grid.pos[sim.grid.pos.length - 2] - yBottom0) < 0.1, 'alt kenar fazla uzamadı')
}

// 7) Determinizm
{
  const run = () => {
    const s = make((p) => {
      p.wind.x = 5
      p.colliders.sphere.enabled = true
    })
    for (let i = 0; i < 90; i++) s.advance(1 / 60)
    return s.grid.pos
  }
  const a = run()
  const b = run()
  check(a.every((v, i) => v === b[i]), 'aynı parametreler → bit bit aynı sonuç')
}

// 8) Çarpışma: masa örtüsü küreye girmiyor, zeminin altına inmiyor
{
  const sim = make((p) => {
    p.orientation = 'horizontal'
    p.pin = 'none'
    p.elevation = 2
    p.colliders.sphere = { enabled: true, x: 0, y: 0.9, z: 0, r: 0.6 }
  })
  for (let i = 0; i < 300; i++) sim.advance(1 / 60)
  const { pos, count } = sim.grid
  let minD = Infinity
  let minY = Infinity
  for (let i = 0; i < count; i++) {
    minD = Math.min(minD, Math.hypot(pos[3 * i], pos[3 * i + 1] - 0.9, pos[3 * i + 2]))
    minY = Math.min(minY, pos[3 * i + 1])
  }
  check(minD > 0.6 - 1e-3, `küreye en yakın parçacık ${minD.toFixed(3)} m (r = 0,6)`)
  check(minY >= 0, `en alçak parçacık y = ${minY.toFixed(3)} m`)
}

// 9) Yırtılma
{
  const pull = (enabled: boolean) => {
    const s = make((p) => {
      p.pin = 'top'
      p.tearing = { enabled, threshold: 0.5 }
    })
    for (let i = 0; i < 60; i++) s.advance(1 / 60)
    const g = s.grid.pos
    const i0 = 29 * 30 + 15
    const x = g[3 * i0]
    s.grab(i0, [x, g[3 * i0 + 1], g[3 * i0 + 2]])
    for (let f = 0; f < 120; f++) {
      s.moveGrab([x, 1 - f * 0.01, 0])
      s.advance(1 / 60)
    }
    return s
  }
  const intact = pull(false)
  check(intact.tear.torn === 0 && intact.index.length === intact.grid.index.length, 'yırtılma kapalıyken hiçbir yay kopmuyor')
  const torn = pull(true)
  check(torn.tear.torn > 0, `aşağı çekilen kumaş yırtıldı (${torn.tear.torn} yay koptu)`)
  check(torn.index.length < torn.grid.index.length, `mesh'ten ${(torn.grid.index.length - torn.index.length) / 6} hücre silindi`)

  // Tutarlılık: kalan her üçgenin kenarları sağlam, her bending yayının iki yarısı sağlam
  const ok = (s: typeof torn) => {
    const alive = new Set<string>()
    for (const kind of ['structural', 'shear'] as const) {
      const sp = s.springs[kind]
      for (let j = 0; j < sp.count; j++) {
        if (!sp.alive[j]) continue
        const a = sp.pairs[2 * j]
        const b = sp.pairs[2 * j + 1]
        alive.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
      }
    }
    const has = (a: number, b: number) => alive.has(`${Math.min(a, b)}-${Math.max(a, b)}`)
    const idx = s.index
    for (let k = 0; k < idx.length; k += 3) {
      if (!has(idx[k], idx[k + 1]) || !has(idx[k + 1], idx[k + 2]) || !has(idx[k], idx[k + 2])) return false
    }
    const bd = s.springs.bending
    for (let j = 0; j < bd.count; j++) {
      if (!bd.alive[j]) continue
      const a = bd.pairs[2 * j]
      const b = bd.pairs[2 * j + 1]
      if (!has(a, (a + b) / 2) || !has((a + b) / 2, b)) return false
    }
    return true
  }
  check(ok(torn), 'kalan üçgenlerin ve bending yaylarının hepsi sağlam yaylara dayanıyor')

  // Bıçak: ortadan yatay kesilen kumaşın alt yarısı düşer
  const cut = make((p) => {
    p.pin = 'top'
    p.colliders.ground.enabled = false
  })
  const { n, m, pos } = cut.grid
  const yMid = pos[3 * ((m >> 1) * n) + 1]
  for (let x = -1.1; x <= 1.1; x += 0.02) cut.cut([x, yMid, 0], 0.05)
  check(ok(cut), 'kesikten sonra topoloji tutarlı')
  const bottom = 3 * (n * m - 1) + 1
  const yBottom = pos[bottom]
  for (let i = 0; i < 60; i++) cut.advance(1 / 60)
  check(yBottom - pos[bottom] > 1.5, `kesilen alt yarı serbest düştü (${(yBottom - pos[bottom]).toFixed(2)} m)`)
  check(Math.abs(pos[1] - cut.params.elevation) < 1e-6, 'üst yarı yerinde kaldı')
}

// 10) Telefon hareketi: yerçekimi yönü ve dış (atalet) ivmesi
{
  // Üst kenardan asılı kumaş düzlem içinde gerilemez; ekrana dik (z) yönde serbestçe salınır
  const meanZ = (s: ClothSim) => {
    let z = 0
    for (let i = 0; i < s.grid.count; i++) z += s.grid.pos[3 * i + 2]
    return z / s.grid.count
  }
  const tilted = make((p) => (p.pin = 'top'))
  tilted.gravityDir = [0, -Math.SQRT1_2, Math.SQRT1_2]
  for (let i = 0; i < 120; i++) tilted.advance(1 / 60)
  check(meanZ(tilted) > 0.3, `telefon eğilince kumaş yeni aşağı yöne sarktı (ortalama z = ${meanZ(tilted).toFixed(2)} m)`)

  // Telefon −z yönünde ivmelenince kumaş (telefona göre) +z yönüne savrulur
  const shaken = make((p) => (p.pin = 'top'))
  shaken.external = [0, 0, 15]
  for (let i = 0; i < 15; i++) shaken.advance(1 / 60)
  check(meanZ(shaken) > 0.1, `sallanınca kumaş savruldu (Δz = ${meanZ(shaken).toFixed(3)} m)`)
  const top = shaken.grid.pos.slice(0, 3 * shaken.grid.n)
  const ref = make((p) => (p.pin = 'top')).grid.pos
  check(top.every((v, i) => v === ref[i]), 'sabit noktalar telefona bağlı kaldı (ivmeden etkilenmedi)')
}

// 11) Performans
{
  const sim = make(() => {})
  const t0 = performance.now()
  for (let i = 0; i < 60; i++) sim.advance(1 / 60)
  const ms = (performance.now() - t0) / 60
  console.log(`  30×30 PBD: ${ms.toFixed(2)} ms/kare`)
}

if (failed) {
  console.error('\nBAŞARISIZ')
  process.exit(1)
}
console.log('\nTüm kontroller geçti.')

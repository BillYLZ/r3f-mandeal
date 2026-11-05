import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ClothSim } from '../physics/ClothSim.ts'
import type { SpringKind } from '../physics/springs.ts'
import { useCloth } from '../store.ts'

export const SPRING_COLORS: Record<SpringKind, string> = {
  structural: '#4f8cff',
  shear: '#3ddc84',
  bending: '#ff9b42',
}

const tmp = new THREE.Color()
const BLUE = new THREE.Color('#2f6bff')
const WHITE = new THREE.Color('#f4f4f4')
const RED = new THREE.Color('#ff3b30')

/** Gerilme rengi: sıkışma → mavi, dinlenme → beyaz, uzama → kırmızı (±%10'da doygun) */
function stressColor(strain: number, out: THREE.Color) {
  const t = Math.max(-1, Math.min(1, strain / 0.1))
  return t >= 0 ? out.copy(WHITE).lerp(RED, t) : out.copy(WHITE).lerp(BLUE, -t)
}

export function SpringLines({ sim, kind }: { sim: ClothSim; kind: SpringKind }) {
  const visible = useCloth((s) => s.layers.springs[kind])
  const stress = useCloth((s) => s.layers.stress)
  const s = sim.springs[kind]
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * s.count), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6 * s.count), 3).setUsage(THREE.DynamicDrawUsage))
    return g
  }, [s])
  useEffect(() => () => geom.dispose(), [geom])

  useFrame(() => {
    if (!visible) return
    const p = sim.grid.pos
    const out = geom.attributes.position.array as Float32Array
    const col = geom.attributes.color.array as Float32Array
    const base = tmp.set(SPRING_COLORS[kind])
    let r = base.r
    let g = base.g
    let b = base.b
    for (let j = 0; j < s.count; j++) {
      const a = 3 * s.pairs[2 * j]
      // Kopmuş yay: sıfır uzunluklu doğru parçası (çizilmez)
      const c = s.alive[j] ? 3 * s.pairs[2 * j + 1] : a
      out[6 * j] = p[a]
      out[6 * j + 1] = p[a + 1]
      out[6 * j + 2] = p[a + 2]
      out[6 * j + 3] = p[c]
      out[6 * j + 4] = p[c + 1]
      out[6 * j + 5] = p[c + 2]
      if (stress && s.alive[j]) {
        const l = Math.hypot(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2])
        const k = stressColor((l - s.rest[j]) / s.rest[j], tmp)
        r = k.r
        g = k.g
        b = k.b
      }
      col.set([r, g, b, r, g, b], 6 * j)
    }
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    geom.computeBoundingSphere()
  })

  return (
    <lineSegments geometry={geom} visible={visible} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} depthTest={!stress} />
    </lineSegments>
  )
}

export function Particles({ sim }: { sim: ClothSim }) {
  const visible = useCloth((s) => s.layers.particles)
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(sim.grid.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * sim.grid.count), 3))
    return g
  }, [sim])
  useEffect(() => () => geom.dispose(), [geom])

  useFrame(() => {
    if (!visible) return
    const col = geom.attributes.color.array as Float32Array
    for (let i = 0; i < sim.grid.count; i++) {
      const pinned = sim.isPinned(i)
      col[3 * i] = pinned ? 1 : 0.92
      col[3 * i + 1] = pinned ? 0.2 : 0.92
      col[3 * i + 2] = pinned ? 0.2 : 0.92
    }
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    geom.computeBoundingSphere()
  })

  return (
    <points geometry={geom} visible={visible} frustumCulled={false}>
      <pointsMaterial size={0.035} vertexColors sizeAttenuation depthTest={false} />
    </points>
  )
}

/** Sabitlenmiş parçacıklar her zaman küçük kırmızı noktalarla gösterilir. */
export function PinMarkers({ sim }: { sim: ClothSim }) {
  const geom = useMemo(() => new THREE.BufferGeometry(), [sim])
  useEffect(() => () => geom.dispose(), [geom])
  useFrame(() => {
    const out: number[] = []
    const p = sim.grid.pos
    for (let i = 0; i < sim.grid.count; i++) if (sim.isPinned(i)) out.push(p[3 * i], p[3 * i + 1], p[3 * i + 2])
    geom.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
    geom.computeBoundingSphere()
  })
  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial size={0.05} color="#ff4d4d" sizeAttenuation />
    </points>
  )
}

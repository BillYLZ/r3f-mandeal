import { Grid, OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { motion } from '../motion.ts'
import { ClothSim } from '../physics/ClothSim.ts'
import { SPRING_KINDS } from '../physics/springs.ts'
import { useCloth } from '../store.ts'
import { ClothMesh } from './ClothMesh.tsx'
import { Particles, PinMarkers, SpringLines } from './DebugLayers.tsx'

const DEADZONE = 0.4 // m/s², sensör gürültüsü
const _dir = new THREE.Vector3()

/**
 * Telefon sensörünü simülasyona bağlar. Ekran eksenleri (sağ, yukarı, ekrandan dışarı)
 * kameranın yatay yönüne göre dünyaya çevrilir; "yukarı" her zaman dünya yukarısıdır,
 * böylece telefon dik tutulurken yerçekimi tam aşağıyı gösterir.
 */
function applyMotion(sim: ClothSim, camera: THREE.Camera) {
  const m = useCloth.getState().motion
  if (!m.enabled || !motion.active) {
    sim.external = [0, 0, 0]
    sim.gravityDir = [0, -1, 0]
    return
  }
  camera.getWorldDirection(_dir)
  let bx = -_dir.x
  let bz = -_dir.z
  const bl = Math.hypot(bx, bz) || 1
  bx /= bl
  bz /= bl
  // sağ = yukarı × arka
  const rx = bz
  const rz = -bx
  const toWorld = ([x, y, z]: [number, number, number]): [number, number, number] => [rx * x + bx * z, y, rz * x + bz * z]

  if (m.shake) {
    const s = motion.shake
    const mag = Math.hypot(s[0], s[1], s[2])
    const k = mag > DEADZONE ? (-m.gain * (mag - DEADZONE)) / mag : 0
    const w = toWorld(s)
    sim.external = [w[0] * k, w[1] * k, w[2] * k]
  } else {
    sim.external = [0, 0, 0]
  }

  if (m.tilt) {
    const u = toWorld(motion.up)
    const l = Math.hypot(u[0], u[1], u[2])
    sim.gravityDir = l > 1 ? [-u[0] / l, -u[1] / l, -u[2] / l] : [0, -1, 0]
  } else {
    sim.gravityDir = [0, -1, 0]
  }
}

/** Dar (dikey) ekranlarda kumaş sığsın diye kamerayı başta uzaklaştır. */
function FitCamera() {
  const camera = useThree((s) => s.camera)
  const aspect = useThree((s) => s.size.width / s.size.height)
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || aspect >= 1) return
    const halfWidth = 1.6 // m, kumaş + kenar payı
    const dist = Math.max(4.6, halfWidth / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect))
    camera.position.set(0, 1.5, dist)
    camera.lookAt(0, 1.3, 0)
    // Yalnızca ilk açılışta; sonra kullanıcı kamerayı serbestçe döndürür
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera])
  return null
}

function Colliders() {
  const c = useCloth((s) => s.params.colliders)
  return (
    <>
      {c.sphere.enabled && (
        <mesh position={[c.sphere.x, c.sphere.y, c.sphere.z]} castShadow receiveShadow>
          {/* Kumaşın içine gömülmemesi için çizilen küre biraz küçük */}
          <sphereGeometry args={[c.sphere.r * 0.985, 48, 32]} />
          <meshStandardMaterial color="#8a93a8" roughness={0.4} metalness={0.1} />
        </mesh>
      )}
      {c.ground.enabled && (
        <mesh rotation-x={-Math.PI / 2} position-y={c.ground.y} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.35} />
        </mesh>
      )}
    </>
  )
}

export function ClothScene() {
  const version = useCloth((s) => s.version)
  // Izgara parametreleri değişince (version) simülasyon baştan kurulur
  const sim = useMemo(() => new ClothSim(useCloth.getState().params), [version])
  const statsClock = useRef({ t: 0, frames: 0, steps: 0, ms: 0 })
  const lastToken = useRef(useCloth.getState().stepToken)

  useEffect(() => () => sim.release(), [sim])

  const camera = useThree((s) => s.camera)

  useFrame((_, delta) => {
    const st = useCloth.getState()
    sim.params = st.params
    applyMotion(sim, camera)
    const t0 = performance.now()
    let steps = 0
    if (st.playing) {
      steps = sim.advance(delta * st.timeScale)
    } else if (st.stepToken !== lastToken.current) {
      sim.step()
      steps = 1
    } else {
      sim.holdGrab()
    }
    lastToken.current = st.stepToken

    const c = statsClock.current
    c.t += delta
    c.frames++
    c.steps += steps
    c.ms += performance.now() - t0
    if (c.t > 0.25 || steps === 1) {
      st.setStats({
        ...sim.stats(),
        fps: c.frames / c.t,
        stepsPerFrame: c.steps / c.frames,
        physicsMs: c.ms / c.frames,
        criticalDt: sim.criticalDt(),
      })
      statsClock.current = { t: 0, frames: 0, steps: 0, ms: 0 }
    }
  })

  return (
    <>
      <color attach="background" args={['#0b0e18']} />
      <fog attach="fog" args={['#0b0e18', 8, 22]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#bcd0ff', '#2a2018', 0.5]} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
      />
      <ClothMesh sim={sim} />
      {SPRING_KINDS.map((k) => (
        <SpringLines key={k} sim={sim} kind={k} />
      ))}
      <Particles sim={sim} />
      <PinMarkers sim={sim} />
      <Colliders />
      <FitCamera />
      <Grid args={[30, 30]} cellSize={0.25} sectionSize={1} cellColor="#1e2540" sectionColor="#2e3966" fadeDistance={18} infiniteGrid position-y={-0.001} />
      <OrbitControls makeDefault target={[0, 1.3, 0]} enableDamping maxPolarAngle={Math.PI * 0.495} minDistance={0.8} maxDistance={16} />
    </>
  )
}

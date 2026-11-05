import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ClothSim } from '../physics/ClothSim.ts'
import { useCloth } from '../store.ts'
import { makeTexture } from './textures.ts'

function useClothGeometry(sim: ClothSim) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // Fizik dizisi doğrudan öznitelik olarak paylaşılır; her kare yalnızca needsUpdate
    const pos = new THREE.BufferAttribute(sim.grid.pos, 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('position', pos)
    g.setAttribute('uv', new THREE.BufferAttribute(sim.grid.uv, 2))
    g.setIndex(new THREE.BufferAttribute(sim.index, 1))
    g.computeVertexNormals()
    return g
  }, [sim])
  useEffect(() => () => geom.dispose(), [geom])
  const topology = useRef(sim.tear.version)
  useFrame(() => {
    // Yırtılma: kopan hücrelerin üçgenleri indeksten çıkarılır
    if (topology.current !== sim.tear.version) {
      topology.current = sim.tear.version
      geom.setIndex(new THREE.BufferAttribute(sim.index, 1))
    }
    geom.attributes.position.needsUpdate = true
    geom.computeVertexNormals()
    geom.computeBoundingSphere()
  })
  return geom
}

function Material({ map }: { map: THREE.Texture | null }) {
  const color = useCloth((s) => s.color)
  const texture = useCloth((s) => s.texture)
  const wireframe = useCloth((s) => s.layers.wireframe)
  return (
    <meshStandardMaterial
      map={map}
      color={map ? '#ffffff' : texture === 'duz' ? color : '#ffffff'}
      side={THREE.DoubleSide}
      roughness={0.85}
      wireframe={wireframe}
    />
  )
}

function UploadedMaterial({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url)
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
  }, [tex])
  return <Material map={tex} />
}

function ProceduralMaterial() {
  const kind = useCloth((s) => s.texture)
  const color = useCloth((s) => s.color)
  const map = useMemo(() => makeTexture(kind, color), [kind, color])
  useEffect(() => () => map?.dispose(), [map])
  return <Material map={map} />
}

/** Kumaş yüzeyi + fare etkileşimi: sürükle, Shift+tık pin, bıçak (Ctrl veya ✂ aracı) */
export function ClothMesh({ sim }: { sim: ClothSim }) {
  const geom = useClothGeometry(sim)
  const texture = useCloth((s) => s.texture)
  const url = useCloth((s) => s.uploadedUrl)
  const visible = useCloth((s) => s.layers.cloth)
  const { camera, gl, controls } = useThree()
  const plane = useRef(new THREE.Plane())
  const ray = useRef(new THREE.Raycaster())
  const mesh = useRef<THREE.Mesh>(null)

  const pointerRay = (ev: PointerEvent) => {
    const r = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.current.setFromCamera(ndc, camera)
    return ray.current
  }

  /** Bıçak: imlecin altındaki kumaş noktasının çevresindeki yaylar kesilir */
  const startCut = (p: THREE.Vector3) => {
    const { width, height, n, m } = sim.params
    const radius = 0.75 * Math.max(width / (n - 1), height / (m - 1))
    sim.cut([p.x, p.y, p.z], radius)
    return (ev: PointerEvent) => {
      if (!mesh.current) return
      const hit = pointerRay(ev).intersectObject(mesh.current, false)[0]
      if (hit) sim.cut([hit.point.x, hit.point.y, hit.point.z], radius)
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!e.face) return
    e.stopPropagation()
    const { pos } = sim.grid
    let best = e.face.a
    let bestD = Infinity
    for (const i of [e.face.a, e.face.b, e.face.c]) {
      const d = e.point.distanceToSquared(new THREE.Vector3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]))
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (e.shiftKey) {
      sim.togglePin(best)
      return
    }
    const ctl = controls as unknown as { enabled: boolean } | null
    if (ctl) ctl.enabled = false
    const cutting = (useCloth.getState().tool === 'cut') !== (e.ctrlKey || e.metaKey)

    let onMove: (ev: PointerEvent) => void
    if (cutting) {
      onMove = startCut(e.point)
    } else {
      const p = new THREE.Vector3(pos[3 * best], pos[3 * best + 1], pos[3 * best + 2])
      plane.current.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), p)
      sim.grab(best, [p.x, p.y, p.z])
      onMove = (ev: PointerEvent) => {
        const hit = pointerRay(ev).ray.intersectPlane(plane.current, new THREE.Vector3())
        if (hit) sim.moveGrab([hit.x, hit.y, hit.z])
      }
    }
    const onUp = () => {
      sim.release()
      if (ctl) ctl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <mesh ref={mesh} geometry={geom} visible={visible} castShadow receiveShadow onPointerDown={onPointerDown} frustumCulled={false}>
      {texture === 'yuklenen' && url ? (
        <Suspense fallback={<Material map={null} />}>
          <UploadedMaterial url={url} />
        </Suspense>
      ) : (
        <ProceduralMaterial />
      )}
    </mesh>
  )
}

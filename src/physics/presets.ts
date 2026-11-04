import type { ClothParams, Solver, SolverParams } from './ClothSim.ts'

export const DEFAULT_PARAMS: ClothParams = {
  n: 30,
  m: 30,
  width: 2,
  height: 2,
  mass: 0.5,
  orientation: 'vertical',
  pin: 'corners',
  elevation: 2.6,

  solver: 'pbd',
  dt: 1 / 240,
  iterations: 15,
  damping: 0.01,
  gravity: 9.81,
  springs: {
    structural: { enabled: true, k: 300, kd: 0.05, stiffness: 1 },
    shear: { enabled: true, k: 150, kd: 0.03, stiffness: 0.8 },
    bending: { enabled: true, k: 30, kd: 0.01, stiffness: 0.2 },
  },
  wind: { x: 0, y: 0, z: 0, turbulence: 0.5, drag: 0.6 },
  colliders: {
    ground: { enabled: true, y: 0 },
    sphere: { enabled: false, x: 0, y: 0.8, z: 0, r: 0.5 },
    friction: 0.3,
  },
}

/** Çözücü değişince önerilen adım: kuvvet modu çok daha küçük Δt ister. */
export const SOLVER_DT: Record<Solver, number> = { pbd: 1 / 240, force: 1 / 2000 }

/** Izgarayı yeniden kurmayı gerektiren alanlar */
export const GRID_KEYS = ['n', 'm', 'width', 'height', 'mass', 'orientation', 'pin', 'elevation'] as const

export interface Preset {
  label: string
  apply: (p: ClothParams) => ClothParams
}

const withSolver = (p: ClothParams, s: Partial<SolverParams>): ClothParams => ({ ...p, ...s })

export const PRESETS: Preset[] = [
  {
    label: 'Köşelerden asılı',
    apply: (p) => ({ ...p, n: 30, m: 30, orientation: 'vertical', pin: 'corners', width: 2, height: 2, elevation: 2.6, wind: { ...p.wind, x: 0, z: 0 }, colliders: { ...p.colliders, sphere: { ...p.colliders.sphere, enabled: false } } }),
  },
  {
    label: 'Perde',
    apply: (p) => ({ ...p, n: 36, m: 32, orientation: 'vertical', pin: 'top', width: 2.4, height: 2.2, elevation: 2.6, wind: { ...p.wind, x: 0, z: 1.5, turbulence: 0.8 }, colliders: { ...p.colliders, sphere: { ...p.colliders.sphere, enabled: false } } }),
  },
  {
    label: 'Bayrak',
    apply: (p) =>
      withSolver({ ...p, orientation: 'vertical', pin: 'left', width: 2.4, height: 1.6, elevation: 2.6, n: 36, m: 24 }, {
        wind: { ...p.wind, x: 7, y: 0, z: 1.5, turbulence: 0.6 },
        colliders: { ...p.colliders, sphere: { ...p.colliders.sphere, enabled: false } },
      }),
  },
  {
    label: 'Masa örtüsü',
    apply: (p) => ({
      ...p,
      n: 34,
      m: 34,
      orientation: 'horizontal',
      pin: 'none',
      width: 2,
      height: 2,
      elevation: 2,
      wind: { ...p.wind, x: 0, z: 0 },
      colliders: { ...p.colliders, friction: 0.5, sphere: { enabled: true, x: 0, y: 0.9, z: 0, r: 0.6 } },
    }),
  },
  {
    label: 'Hamak',
    apply: (p) => ({ ...p, n: 36, m: 18, orientation: 'horizontal', pin: 'leftright', width: 2.4, height: 1.2, elevation: 1.6, wind: { ...p.wind, x: 0, z: 0 }, colliders: { ...p.colliders, sphere: { ...p.colliders.sphere, enabled: false } } }),
  },
]

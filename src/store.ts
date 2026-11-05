import { create } from 'zustand'
import type { ClothParams, ClothStats } from './physics/ClothSim.ts'
import { DEFAULT_PARAMS, GRID_KEYS } from './physics/presets.ts'
import type { SpringKind } from './physics/springs.ts'

export type Tool = 'drag' | 'cut'

export type TextureKind = 'ekose' | 'cizgili' | 'kanvas' | 'izgara' | 'duz' | 'yuklenen'

export interface Layers {
  cloth: boolean
  wireframe: boolean
  particles: boolean
  stress: boolean
  springs: Record<SpringKind, boolean>
}

export interface LiveStats extends ClothStats {
  fps: number
  stepsPerFrame: number
  physicsMs: number
  criticalDt: number
}

interface State {
  params: ClothParams
  /** Arttığında simülasyon baştan kurulur */
  version: number
  playing: boolean
  timeScale: number
  /** Duraklatılmışken tek adım isteği sayacı */
  stepToken: number
  layers: Layers
  texture: TextureKind
  color: string
  uploadedUrl: string | null
  stats: LiveStats | null
  /** Fare aracı: kumaşı çek veya bıçakla kes (Ctrl basılıyken tersi) */
  tool: Tool
  setTool: (t: Tool) => void
  setParams: (f: (p: ClothParams) => ClothParams) => void
  reset: () => void
  setPlaying: (p: boolean) => void
  setTimeScale: (s: number) => void
  stepOnce: () => void
  setLayers: (f: (l: Layers) => Layers) => void
  setTexture: (t: TextureKind) => void
  setColor: (c: string) => void
  setUploadedUrl: (u: string | null) => void
  setStats: (s: LiveStats) => void
}

export const useCloth = create<State>((set, get) => ({
  params: structuredClone(DEFAULT_PARAMS),
  version: 0,
  playing: true,
  timeScale: 1,
  stepToken: 0,
  layers: {
    cloth: true,
    wireframe: false,
    particles: false,
    stress: false,
    springs: { structural: false, shear: false, bending: false },
  },
  texture: 'ekose',
  color: '#c8553d',
  uploadedUrl: null,
  stats: null,
  tool: 'drag',
  setTool: (tool) => set({ tool }),
  setParams: (f) => {
    const old = get().params
    const params = f(old)
    const rebuild = GRID_KEYS.some((k) => params[k] !== old[k])
    set((s) => ({ params, version: rebuild ? s.version + 1 : s.version }))
  },
  reset: () => set((s) => ({ version: s.version + 1 })),
  setPlaying: (playing) => set({ playing }),
  setTimeScale: (timeScale) => set({ timeScale }),
  stepOnce: () => set((s) => ({ stepToken: s.stepToken + 1, playing: false })),
  setLayers: (f) => set((s) => ({ layers: f(s.layers) })),
  setTexture: (texture) => set({ texture }),
  setColor: (color) => set({ color }),
  setUploadedUrl: (uploadedUrl) => {
    const old = get().uploadedUrl
    if (old && old !== uploadedUrl) URL.revokeObjectURL(old)
    set({ uploadedUrl, texture: uploadedUrl ? 'yuklenen' : get().texture })
  },
  setStats: (stats) => set({ stats }),
}))

import * as THREE from 'three'
import type { TextureKind } from '../store.ts'

const SIZE = 512

function canvas(draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const el = document.createElement('canvas')
  el.width = el.height = SIZE
  const ctx = el.getContext('2d')!
  draw(ctx, SIZE)
  const tex = new THREE.CanvasTexture(el)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Ekose: üst üste binen yarı saydam yatay/dikey şeritler */
function plaid(c: CanvasRenderingContext2D, s: number, base: string) {
  c.fillStyle = base
  c.fillRect(0, 0, s, s)
  const bands: [number, number, string][] = [
    [0, 0.18, 'rgba(20,30,60,0.55)'],
    [0.28, 0.06, 'rgba(255,255,255,0.35)'],
    [0.5, 0.18, 'rgba(20,30,60,0.55)'],
    [0.78, 0.06, 'rgba(240,200,60,0.5)'],
  ]
  for (const [o, w, col] of bands) {
    c.fillStyle = col
    c.fillRect(o * s, 0, w * s, s)
    c.fillRect(0, o * s, s, w * s)
  }
  weave(c, s, 0.08)
}

function stripes(c: CanvasRenderingContext2D, s: number, base: string) {
  c.fillStyle = '#f2efe6'
  c.fillRect(0, 0, s, s)
  c.fillStyle = base
  for (let i = 0; i < 8; i++) c.fillRect(0, (i * s) / 8, s, s / 16)
  weave(c, s, 0.06)
}

/** İnce dokuma deseni: tek/çift iplik satırları hafif aydınlık/karanlık */
function weave(c: CanvasRenderingContext2D, s: number, strength: number) {
  const step = 4
  for (let y = 0; y < s; y += step) {
    for (let x = 0; x < s; x += step) {
      const on = ((x / step) ^ (y / step)) & 1
      c.fillStyle = on ? `rgba(255,255,255,${strength})` : `rgba(0,0,0,${strength})`
      c.fillRect(x, y, step, step)
    }
  }
}

function canvasCloth(c: CanvasRenderingContext2D, s: number, base: string) {
  c.fillStyle = base
  c.fillRect(0, 0, s, s)
  weave(c, s, 0.14)
}

function uvGrid(c: CanvasRenderingContext2D, s: number) {
  const n = 8
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      c.fillStyle = `hsl(${(x * 360) / n}, 55%, ${(x + y) % 2 ? 45 : 62}%)`
      c.fillRect((x * s) / n, (y * s) / n, s / n, s / n)
    }
  }
  c.fillStyle = 'rgba(255,255,255,0.9)'
  c.font = `${s / 18}px sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) c.fillText(`${x},${n - 1 - y}`, ((x + 0.5) * s) / n, ((y + 0.5) * s) / n)
}

export function makeTexture(kind: TextureKind, color: string): THREE.Texture | null {
  switch (kind) {
    case 'ekose':
      return canvas((c, s) => plaid(c, s, color))
    case 'cizgili':
      return canvas((c, s) => stripes(c, s, color))
    case 'kanvas':
      return canvas((c, s) => canvasCloth(c, s, color))
    case 'izgara':
      return canvas(uvGrid)
    case 'duz':
    case 'yuklenen':
      return null
  }
}

import type { ReactNode } from 'react'

export const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '∞')

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  digits?: number
  log?: boolean
  /** Görüntülenen değer dönüşümü (ör. s → ms) */
  display?: (v: number) => string
  onChange: (v: number) => void
}

/** Logaritmik seçenekli kaydırıcı */
export function Slider({ label, value, min, max, step, unit = '', digits = 2, log, display, onChange }: SliderProps) {
  const toPos = (v: number) => (log ? Math.log(v) : v)
  const fromPos = (p: number) => (log ? Math.exp(p) : p)
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span className="val">
          {display ? display(value) : fmt(value, digits)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={toPos(min)}
        max={toPos(max)}
        step={log ? (toPos(max) - toPos(min)) / 1000 : step}
        value={toPos(value)}
        onChange={(e) => {
          const v = fromPos(Number(e.target.value))
          onChange(log ? v : Math.round(v / step) * step)
        }}
      />
    </label>
  )
}

export function Check({ label, checked, onChange, swatch }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; swatch?: string }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {swatch && <span className="sw" style={{ background: swatch }} />}
      {label}
    </label>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      {children}
    </>
  )
}

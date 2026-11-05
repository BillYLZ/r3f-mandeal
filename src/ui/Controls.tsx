import { useEffect, useState } from 'react'
import { motionSupported, startMotion, stopMotion } from '../motion.ts'
import { useCloth } from '../store.ts'

const SPEEDS = [0.1, 0.25, 0.5, 1]

const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/** 📱 Salla: telefonun hareket sensörünü aç/kapa (iOS'ta izin ister) */
export function MotionButton() {
  const enabled = useCloth((s) => s.motion.enabled)
  const setMotion = useCloth((s) => s.setMotion)
  const [msg, setMsg] = useState<string | null>(null)
  if (!motionSupported() || !isTouch()) return null
  return (
    <>
      <button
        className={enabled ? 'on' : ''}
        onClick={async () => {
          if (enabled) {
            stopMotion()
            setMotion({ enabled: false })
            return
          }
          const r = await startMotion()
          if (r === 'ok') {
            setMotion({ enabled: true })
            setMsg(null)
          } else {
            setMsg(r === 'denied' ? 'Hareket sensörü izni verilmedi.' : 'Bu cihaz hareket sensörünü desteklemiyor.')
          }
        }}
      >
        📱 Salla
      </button>
      {msg && <span className="warn">{msg}</span>}
    </>
  )
}

export function Controls() {
  const playing = useCloth((s) => s.playing)
  const timeScale = useCloth((s) => s.timeScale)
  const setPlaying = useCloth((s) => s.setPlaying)
  const setTimeScale = useCloth((s) => s.setTimeScale)
  const stepOnce = useCloth((s) => s.stepOnce)
  const reset = useCloth((s) => s.reset)
  const tool = useCloth((s) => s.tool)
  const setTool = useCloth((s) => s.setTool)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying(!useCloth.getState().playing)
      } else if (e.key === 'r' || e.key === 'R') reset()
      else if (e.key === '.') stepOnce()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlaying, reset, stepOnce])

  return (
    <div className="panel controls">
      <button className="accent" onClick={() => setPlaying(!playing)} title="Boşluk">
        {playing ? '⏸ Durdur' : '▶ Oynat'}
      </button>
      <button className="step" onClick={stepOnce} title=".">
        ⏭ Tek adım
      </button>
      <button onClick={reset} title="R">
        ↺ Sıfırla
      </button>
      <div className="seg" title="Ctrl basılıyken araç geçici olarak değişir">
        <button className={tool === 'drag' ? 'on' : ''} onClick={() => setTool('drag')}>
          ✋ Çek
        </button>
        <button className={tool === 'cut' ? 'on' : ''} onClick={() => setTool('cut')}>
          ✂ Kes
        </button>
      </div>
      <MotionButton />
      <span className="dim">Hız</span>
      <div className="seg">
        {SPEEDS.map((v) => (
          <button key={v} className={timeScale === v ? 'on' : ''} onClick={() => setTimeScale(v)}>
            {v.toLocaleString('tr-TR')}×
          </button>
        ))}
      </div>
    </div>
  )
}

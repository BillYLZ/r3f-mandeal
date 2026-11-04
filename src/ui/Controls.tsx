import { useEffect } from 'react'
import { useCloth } from '../store.ts'

const SPEEDS = [0.1, 0.25, 0.5, 1]

export function Controls() {
  const playing = useCloth((s) => s.playing)
  const timeScale = useCloth((s) => s.timeScale)
  const setPlaying = useCloth((s) => s.setPlaying)
  const setTimeScale = useCloth((s) => s.setTimeScale)
  const stepOnce = useCloth((s) => s.stepOnce)
  const reset = useCloth((s) => s.reset)

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
      <button onClick={stepOnce} title=".">
        ⏭ Tek adım
      </button>
      <button onClick={reset} title="R">
        ↺ Sıfırla
      </button>
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

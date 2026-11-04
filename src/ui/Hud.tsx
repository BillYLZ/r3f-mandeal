import { SPRING_KINDS } from '../physics/springs.ts'
import { useCloth } from '../store.ts'
import { fmt } from './widgets.tsx'

export function Hud() {
  const s = useCloth((st) => st.stats)
  const p = useCloth((st) => st.params)
  const reset = useCloth((st) => st.reset)
  const springs = SPRING_KINDS.filter((k) => p.springs[k].enabled).length
  const unstable = p.solver === 'force' && s && p.dt > s.criticalDt
  return (
    <div className="panel hud">
      <div className="title">
        <h1>Kumaş simülasyonu</h1>
        <span className="badge">{p.solver === 'pbd' ? 'PBD' : 'Kütle–yay'}</span>
      </div>
      <div className="dim">
        {p.n} × {p.m} parçacık · {springs}/3 yay türü · Verlet
      </div>
      {s && (
        <>
          <h2>Zaman</h2>
          <table>
            <tbody>
              <tr>
                <th>Simülasyon zamanı</th>
                <td>{fmt(s.time, 2)} s</td>
              </tr>
              <tr>
                <th>fps · adım/kare</th>
                <td>
                  {fmt(s.fps, 0)} · {fmt(s.stepsPerFrame, 1)}
                </td>
              </tr>
              <tr>
                <th>Fizik süresi</th>
                <td>{fmt(s.physicsMs, 2)} ms/kare</td>
              </tr>
            </tbody>
          </table>
          <h2>Enerji</h2>
          <table>
            <tbody>
              <tr>
                <th>Kinetik</th>
                <td>{fmt(s.kinetic * 1000, 2)} mJ</td>
              </tr>
              <tr>
                <th>Yerçekimi potansiyeli</th>
                <td>{fmt(s.potential, 3)} J</td>
              </tr>
              {p.solver === 'force' && (
                <tr>
                  <th>Yay potansiyeli</th>
                  <td>{fmt(s.springEnergy * 1000, 2)} mJ</td>
                </tr>
              )}
              <tr>
                <th>En büyük uzama</th>
                <td className={s.maxStretch > 0.1 ? 'warn' : ''}>%{fmt(s.maxStretch * 100, 2)}</td>
              </tr>
            </tbody>
          </table>
          {unstable && !s.exploded && (
            <div className="warn">
              ⚠ Δt = {fmt(p.dt * 1000, 2)} ms, kararlılık sınırı ≈ {fmt(s.criticalDt * 1000, 2)} ms. Δt'yi küçült veya k'yı azalt.
            </div>
          )}
          {s.exploded && (
            <div className="warn">
              ✗ Simülasyon kararsızlaştı (sayılar sonsuza gitti).{' '}
              <button className="accent" onClick={reset}>
                Sıfırla
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

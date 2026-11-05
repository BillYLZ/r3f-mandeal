import type { ClothParams, SpringParams } from '../physics/ClothSim.ts'
import type { Orientation, PinMode } from '../physics/grid.ts'
import { PRESETS, SOLVER_DT } from '../physics/presets.ts'
import { SPRING_KINDS, type SpringKind } from '../physics/springs.ts'
import { SPRING_COLORS } from '../scene/DebugLayers.tsx'
import { useCloth } from '../store.ts'
import { MotionButton } from './Controls.tsx'
import { Check, Section, Seg, Slider, fmt } from './widgets.tsx'

export const SPRING_LABELS: Record<SpringKind, string> = {
  structural: 'Structural',
  shear: 'Shear',
  bending: 'Bending',
}

const PIN_LABELS: [PinMode, string][] = [
  ['corners', 'Üst köşeler'],
  ['top', 'Üst kenar'],
  ['left', 'Sol kenar'],
  ['leftright', 'Sol + sağ'],
  ['none', 'Yok'],
]

export function Params() {
  const p = useCloth((s) => s.params)
  const setParams = useCloth((s) => s.setParams)
  const reset = useCloth((s) => s.reset)
  const set = (patch: Partial<ClothParams>) => setParams((o) => ({ ...o, ...patch }))
  const setSpring = (k: SpringKind, patch: Partial<SpringParams>) =>
    setParams((o) => ({ ...o, springs: { ...o.springs, [k]: { ...o.springs[k], ...patch } } }))
  const setWind = (patch: Partial<ClothParams['wind']>) => setParams((o) => ({ ...o, wind: { ...o.wind, ...patch } }))
  const setCol = (patch: Partial<ClothParams['colliders']>) => setParams((o) => ({ ...o, colliders: { ...o.colliders, ...patch } }))
  const force = p.solver === 'force'
  const motionCfg = useCloth((s) => s.motion)
  const setMotion = useCloth((s) => s.setMotion)

  return (
    <div className="params">
      <Section title="Hazır senaryolar">
        <div className="presets">
          {PRESETS.map((pr) => (
            <button
              key={pr.label}
              onClick={() => {
                setParams((o) => pr.apply({ ...o, tearing: { ...o.tearing, enabled: false } }))
                reset()
              }}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Izgara · ${p.n} × ${p.m} = ${p.n * p.m} parçacık`}>
        <Slider label="n (sütun)" value={p.n} min={2} max={80} step={1} digits={0} onChange={(n) => set({ n })} />
        <Slider label="m (satır)" value={p.m} min={2} max={80} step={1} digits={0} onChange={(m) => set({ m })} />
        <Slider label="Genişlik" value={p.width} min={0.5} max={4} step={0.1} digits={1} unit="m" onChange={(width) => set({ width })} />
        <Slider label="Yükseklik" value={p.height} min={0.5} max={4} step={0.1} digits={1} unit="m" onChange={(height) => set({ height })} />
        <Slider label="Toplam kütle" value={p.mass} min={0.05} max={5} step={0.05} digits={2} unit="kg" log onChange={(mass) => set({ mass })} />
        <div className="row">
          <span className="dim">Yön</span>
          <Seg<Orientation>
            value={p.orientation}
            options={[
              ['vertical', 'Dikey'],
              ['horizontal', 'Yatay'],
            ]}
            onChange={(orientation) => set({ orientation, elevation: orientation === 'vertical' ? 2.6 : 2 })}
          />
        </div>
        <div className="row">
          <span className="dim">Sabit noktalar</span>
          <select value={p.pin} onChange={(e) => set({ pin: e.target.value as PinMode })}>
            {PIN_LABELS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Çözücü">
        <Seg
          value={p.solver}
          options={[
            ['pbd', 'Kısıt (PBD)'],
            ['force', 'Kuvvet (kütle–yay)'],
          ]}
          onChange={(solver) => set({ solver, dt: SOLVER_DT[solver] })}
        />
        <p className="dim">
          {force
            ? 'Yay kuvvetleri Hooke yasasıyla hesaplanır. Sert yaylar küçük Δt ister, yoksa sistem patlar.'
            : 'Verlet adımından sonra yay uzunlukları yinelemeli düzeltilir. Her Δt için kararlıdır.'}
        </p>
        <Slider
          label="Δt (sabit adım)"
          value={p.dt}
          min={1 / 10000}
          max={1 / 60}
          step={1e-5}
          log
          display={(v) => `${fmt(v * 1000, 2)} ms · ${fmt(1 / v, 0)} Hz`}
          onChange={(dt) => set({ dt })}
        />
        {!force && <Slider label="Yineleme" value={p.iterations} min={1} max={60} step={1} digits={0} onChange={(iterations) => set({ iterations })} />}
        <Slider label="Hava sürtünmesi" value={p.damping} min={0} max={0.1} step={0.001} digits={3} onChange={(damping) => set({ damping })} />
        <Slider label="Yerçekimi g" value={p.gravity} min={0} max={20} step={0.01} digits={2} unit="m/s²" onChange={(gravity) => set({ gravity })} />
      </Section>

      <Section title="Yaylar">
        {SPRING_KINDS.map((k) => {
          const s = p.springs[k]
          return (
            <div key={k} className="spring">
              <Check label={SPRING_LABELS[k]} swatch={SPRING_COLORS[k]} checked={s.enabled} onChange={(enabled) => setSpring(k, { enabled })} />
              {s.enabled &&
                (force ? (
                  <>
                    <Slider label="k" value={s.k} min={1} max={5000} step={1} log digits={0} unit="N/m" onChange={(v) => setSpring(k, { k: v })} />
                    <Slider label="kd (sönüm)" value={s.kd} min={0.0001} max={2} step={0.0001} log digits={4} unit="N·s/m" onChange={(kd) => setSpring(k, { kd })} />
                  </>
                ) : (
                  <Slider label="Sertlik" value={s.stiffness} min={0} max={1} step={0.01} onChange={(stiffness) => setSpring(k, { stiffness })} />
                ))}
            </div>
          )
        })}
      </Section>

      <Section title="Rüzgâr">
        <Slider label="x" value={p.wind.x} min={-15} max={15} step={0.1} digits={1} unit="m/s" onChange={(x) => setWind({ x })} />
        <Slider label="z" value={p.wind.z} min={-15} max={15} step={0.1} digits={1} unit="m/s" onChange={(z) => setWind({ z })} />
        <Slider label="Dalgalanma" value={p.wind.turbulence} min={0} max={1.5} step={0.01} onChange={(turbulence) => setWind({ turbulence })} />
        <Slider label="Sürükleme katsayısı" value={p.wind.drag} min={0} max={3} step={0.01} unit="kg/m³" onChange={(drag) => setWind({ drag })} />
      </Section>

      <Section title="Yırtılma">
        <Check label="Aşırı gerilen yaylar kopsun" checked={p.tearing.enabled} onChange={(enabled) => set({ tearing: { ...p.tearing, enabled } })} />
        {p.tearing.enabled && (
          <Slider
            label="Kopma eşiği (uzama)"
            value={p.tearing.threshold}
            min={0.05}
            max={2}
            step={0.01}
            display={(v) => `%${fmt(v * 100, 0)}`}
            onChange={(threshold) => set({ tearing: { ...p.tearing, threshold } })}
          />
        )}
        <p className="dim">
          Kumaşı çekerek yırt veya alttaki <b>✂ Kes</b> aracıyla (ya da <b>Ctrl + sürükle</b>) bıçakla kes. Bıçak, yırtılma kapalıyken de çalışır. <b>↺ Sıfırla</b> kumaşı onarır.
        </p>
      </Section>

      <Section title="Telefon hareketi">
        <p className="dim">
          Telefonda <b>📱 Salla</b> düğmesine bas ve telefonu salla: kumaş telefona tutturulmuş gibi sallanır. iPhone'da önce hareket izni istenir.
        </p>
        <div className="row">
          <MotionButton />
        </div>
        <Check label="Sallama (telefonun ivmesi)" checked={motionCfg.shake} onChange={(shake) => setMotion({ shake })} />
        {motionCfg.shake && (
          <Slider label="Sallama şiddeti" value={motionCfg.gain} min={0.2} max={5} step={0.1} digits={1} unit="×" onChange={(gain) => setMotion({ gain })} />
        )}
        <Check label="Eğim (yerçekimi telefonun aşağısını izler)" checked={motionCfg.tilt} onChange={(tilt) => setMotion({ tilt })} />
      </Section>

      <Section title="Çarpışma">
        <Check label="Zemin" checked={p.colliders.ground.enabled} onChange={(enabled) => setCol({ ground: { ...p.colliders.ground, enabled } })} />
        <Check label="Küre" checked={p.colliders.sphere.enabled} onChange={(enabled) => setCol({ sphere: { ...p.colliders.sphere, enabled } })} />
        {p.colliders.sphere.enabled && (
          <>
            <Slider label="Küre yarıçapı" value={p.colliders.sphere.r} min={0.1} max={1.5} step={0.01} unit="m" onChange={(r) => setCol({ sphere: { ...p.colliders.sphere, r } })} />
            <Slider label="Küre yüksekliği" value={p.colliders.sphere.y} min={0} max={3} step={0.01} unit="m" onChange={(y) => setCol({ sphere: { ...p.colliders.sphere, y } })} />
            <Slider label="Küre z" value={p.colliders.sphere.z} min={-2} max={2} step={0.01} unit="m" onChange={(z) => setCol({ sphere: { ...p.colliders.sphere, z } })} />
          </>
        )}
        <Slider label="Sürtünme" value={p.colliders.friction} min={0} max={1} step={0.01} onChange={(friction) => setCol({ friction })} />
      </Section>
    </div>
  )
}

import { SPRING_KINDS } from '../physics/springs.ts'
import { SPRING_COLORS } from '../scene/DebugLayers.tsx'
import { useCloth, type TextureKind } from '../store.ts'
import { SPRING_LABELS } from './Params.tsx'
import { Check, Section } from './widgets.tsx'

const TEXTURES: [TextureKind, string][] = [
  ['ekose', 'Ekose'],
  ['cizgili', 'Çizgili'],
  ['kanvas', 'Kanvas'],
  ['izgara', 'UV ızgarası'],
  ['duz', 'Düz renk'],
  ['yuklenen', 'Yüklenen görsel'],
]

export function ViewPanel() {
  const texture = useCloth((s) => s.texture)
  const color = useCloth((s) => s.color)
  const url = useCloth((s) => s.uploadedUrl)
  const layers = useCloth((s) => s.layers)
  const setTexture = useCloth((s) => s.setTexture)
  const setColor = useCloth((s) => s.setColor)
  const setUploadedUrl = useCloth((s) => s.setUploadedUrl)
  const setLayers = useCloth((s) => s.setLayers)

  return (
    <div className="params">
      <Section title="Doku">
        <div className="presets">
          {TEXTURES.filter(([k]) => k !== 'yuklenen' || url).map(([k, l]) => (
            <button key={k} className={texture === k ? 'on' : ''} onClick={() => setTexture(k)}>
              {l}
            </button>
          ))}
        </div>
        {texture !== 'izgara' && texture !== 'yuklenen' && (
          <label className="row">
            <span className="dim">Renk</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        )}
        <label className="row">
          <span className="dim">Görsel yükle</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setUploadedUrl(URL.createObjectURL(f))
            }}
          />
        </label>
      </Section>

      <Section title="Katmanlar">
        <Check label="Kumaş yüzeyi" checked={layers.cloth} onChange={(cloth) => setLayers((l) => ({ ...l, cloth }))} />
        <Check label="Tel kafes" checked={layers.wireframe} onChange={(wireframe) => setLayers((l) => ({ ...l, wireframe }))} />
        <Check label="Parçacıklar (kırmızı: sabit)" checked={layers.particles} onChange={(particles) => setLayers((l) => ({ ...l, particles }))} />
        {SPRING_KINDS.map((k) => (
          <Check
            key={k}
            label={`${SPRING_LABELS[k]} yayları`}
            swatch={SPRING_COLORS[k]}
            checked={layers.springs[k]}
            onChange={(v) => setLayers((l) => ({ ...l, springs: { ...l.springs, [k]: v } }))}
          />
        ))}
        <Check label="Gerilme renkleri (mavi sıkışma · kırmızı uzama)" checked={layers.stress} onChange={(stress) => setLayers((l) => ({ ...l, stress }))} />
        <p className="dim">Gerilme renkleri yalnızca açık olan yay katmanlarında görünür.</p>
      </Section>

      <Section title="Etkileşim">
        <p className="dim">
          Kumaşı fareyle tutup sürükle. <b>Shift + tık</b> bir noktayı sabitler veya serbest bırakır. Boş alanda sürüklemek kamerayı döndürür.
        </p>
      </Section>
    </div>
  )
}

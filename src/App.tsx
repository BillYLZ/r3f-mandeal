import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { ClothScene } from './scene/ClothScene.tsx'
import { Controls } from './ui/Controls.tsx'
import { Equations } from './ui/Equations.tsx'
import { Hud } from './ui/Hud.tsx'
import { Params } from './ui/Params.tsx'
import { ViewPanel } from './ui/ViewPanel.tsx'

type Tab = 'params' | 'view' | 'equations'

function SidePanel() {
  const [tab, setTab] = useState<Tab | null>(() => (window.innerWidth > 1100 ? 'params' : null))
  const btn = (t: Tab, label: string) => (
    <button className={tab === t ? 'on' : ''} onClick={() => setTab(tab === t ? null : t)}>
      {label}
    </button>
  )
  return (
    <div className={`panel side ${tab ? '' : 'closed'}`}>
      <div className="tabs">
        {btn('params', '⚙ Fizik')}
        {btn('view', '◐ Görünüm')}
        {btn('equations', '∑ Denklemler')}
        {tab && (
          <button className="close" onClick={() => setTab(null)} aria-label="Kapat">
            ×
          </button>
        )}
      </div>
      {tab === 'params' && <Params />}
      {tab === 'view' && <ViewPanel />}
      {tab === 'equations' && <Equations />}
    </div>
  )
}

export default function App() {
  return (
    <>
      <Canvas shadows camera={{ position: [0, 1.9, 4.6], fov: 45, near: 0.05, far: 60 }} dpr={[1, 2]}>
        <ClothScene />
      </Canvas>
      <Hud />
      <SidePanel />
      <Controls />
      <div className="legend">Sürükle: kumaşı çek · Ctrl + sürükle: kes · Shift + tık: pin aç/kapa · Boşluk: oynat/durdur · R: sıfırla</div>
    </>
  )
}

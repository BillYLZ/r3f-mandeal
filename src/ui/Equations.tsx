import katex from 'katex'
import 'katex/dist/katex.min.css'
import { expectedSpringCount } from '../physics/springs.ts'
import { useCloth } from '../store.ts'
import { fmt } from './widgets.tsx'

function Tex({ children }: { children: string }) {
  const html = katex.renderToString(children, { displayMode: true, throwOnError: false })
  return <div className="tex" dangerouslySetInnerHTML={{ __html: html }} />
}

export function Equations() {
  const p = useCloth((s) => s.params)
  const stats = useCloth((s) => s.stats)
  const force = p.solver === 'force'
  const { n, m } = p

  return (
    <div className="eq-body">
      <h2>1 · Parçacık ızgarası</h2>
      <p>
        {n} × {m} parçacık, her birinin kütlesi <i>m</i> = M / (n·m) = {fmt((p.mass / (n * m)) * 1000, 3)} g. İndeks:
      </p>
      <Tex>{String.raw`i = y\,n + x,\qquad 0 \le x < n,\; 0 \le y < m`}</Tex>

      <h2>2 · Yaylar</h2>
      <Tex>{String.raw`\begin{aligned}
\text{Structural} &: (x,y)\!-\!(x{+}1,y),\ (x,y)\!-\!(x,y{+}1) && N = (n{-}1)m + n(m{-}1) = ${expectedSpringCount('structural', n, m)}\\
\text{Shear} &: (x,y)\!-\!(x{+}1,y{\pm}1) && N = 2(n{-}1)(m{-}1) = ${expectedSpringCount('shear', n, m)}\\
\text{Bending} &: (x,y)\!-\!(x{+}2,y),\ (x,y)\!-\!(x,y{+}2) && N = (n{-}2)m + n(m{-}2) = ${expectedSpringCount('bending', n, m)}
\end{aligned}`}</Tex>

      <h2>3 · Verlet entegrasyonu</h2>
      <p>Hız saklanmaz; bir önceki konumdan örtük olarak gelir. <i>c</i> hava sürtünmesidir:</p>
      <Tex>{String.raw`\mathbf{x}_{t+\Delta t} = \mathbf{x}_t + (1-c)\,(\mathbf{x}_t - \mathbf{x}_{t-\Delta t}) + \mathbf{a}_t\,\Delta t^2`}</Tex>
      <Tex>{String.raw`\mathbf{v}_t \approx \frac{\mathbf{x}_t - \mathbf{x}_{t-\Delta t}}{\Delta t},\qquad \mathbf{a}_t = \frac{\mathbf{F}_t}{m} + \mathbf{g}`}</Tex>
      <p>Fizik sabit Δt = {fmt(p.dt * 1000, 2)} ms ile ilerler; kare süresi bir biriktiricide toplanır, böylece sonuç kare hızından bağımsızdır.</p>

      <h2 className={force ? 'active' : ''}>4a · Kuvvet modu: Hooke yayı + sönüm</h2>
      <Tex>{String.raw`\mathbf{d} = \mathbf{x}_b - \mathbf{x}_a,\quad l = |\mathbf{d}|,\quad \hat{\mathbf{u}} = \mathbf{d}/l`}</Tex>
      <Tex>{String.raw`\mathbf{F}_a = \big[\,k\,(l - L_0) + k_d\,(\mathbf{v}_b - \mathbf{v}_a)\cdot\hat{\mathbf{u}}\,\big]\,\hat{\mathbf{u}},\qquad \mathbf{F}_b = -\mathbf{F}_a`}</Tex>
      <p>Kararlılık sınırı (Verlet için ω·Δt &lt; 2):</p>
      <Tex>{String.raw`\Delta t \lesssim \sqrt{m / \textstyle\sum k}\; ${stats && Number.isFinite(stats.criticalDt) ? String.raw`= ${fmt(stats.criticalDt * 1000, 3)}\ \text{ms}` : ''}`}</Tex>

      <h2 className={!force ? 'active' : ''}>4b · Kısıt modu (Jakobsen / PBD)</h2>
      <p>Verlet adımından sonra her yay {p.iterations} kez uzunluğuna geri çekilir (<i>w</i> = 1/m, <i>s</i> sertlik):</p>
      <Tex>{String.raw`\Delta\mathbf{x} = s\,\frac{l - L_0}{l}\,\mathbf{d},\qquad \mathbf{x}_a \mathrel{+}= \frac{w_a}{w_a + w_b}\,\Delta\mathbf{x},\qquad \mathbf{x}_b \mathrel{-}= \frac{w_b}{w_a + w_b}\,\Delta\mathbf{x}`}</Tex>

      <h2>5 · Rüzgâr</h2>
      <p>Her üçgene bağıl hava hızının normal bileşeniyle orantılı kuvvet, üç köşeye eşit bölünür:</p>
      <Tex>{String.raw`\mathbf{N} = (\mathbf{x}_2-\mathbf{x}_1)\times(\mathbf{x}_3-\mathbf{x}_1),\qquad \mathbf{F} = c_w\,\frac{\mathbf{N}\cdot(\mathbf{v}_{\text{rüzgâr}} - \bar{\mathbf{v}})}{2\,|\mathbf{N}|}\,\mathbf{N}`}</Tex>

      <h2 className={p.tearing.enabled ? 'active' : ''}>6 · Yırtılma</h2>
      <p>Structural veya shear yay, bağıl uzaması eşiği aşınca kalıcı olarak kopar (eşik ε = %{fmt(p.tearing.threshold * 100, 0)}):</p>
      <Tex>{String.raw`\frac{l - L_0}{L_0} > \varepsilon \;\Rightarrow\; \text{yay kopar}`}</Tex>
      <p>Bir hücrenin (iki üçgen) yaylarından biri koparsa hücre mesh'ten silinir ve köşegenleri de kopar. İki yanı da boşalan kenar ile üzerinden geçtiği yay kopan bending yayı da kaldırılır; böylece yırtığın iki yakası tamamen ayrılır.</p>

      <h2>7 · Enerji</h2>
      <Tex>{String.raw`E = \sum_i \tfrac12 m |\mathbf{v}_i|^2 + \sum_i m\,g\,y_i + \sum_{\text{yay}} \tfrac12 k\,(l - L_0)^2`}</Tex>
    </div>
  )
}

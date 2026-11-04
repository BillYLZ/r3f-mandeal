# Kumaş Simülasyonu Aracı — Plan

Amaç: **n × m** parçacıktan oluşan, dokulu bir kumaşı **kütle–yay modeli** ve
**Verlet entegrasyonu** ile gerçek zamanlı simüle eden, parametreleri canlı
değiştirilebilen ve animasyon kaydı alınabilen bir araç.

Mevcut projeyle aynı yığın kullanılır (Vite + React 19 + React Three Fiber +
drei + zustand + KaTeX). Böylece `Params`/`SidePanel`/`Equations` desenleri
yeniden kullanılır ve GitHub Pages dağıtımı aynen çalışır.

---

## 1. Fizik modeli

### 1.1 Parçacık ızgarası

- `n` sütun × `m` satır parçacık; dinlenme aralığı `L0 = W/(n−1)` (yatay),
  `H/(m−1)` (dikey).
- Parçacık `i = y·n + x`.
- Her parçacık: konum `x`, önceki konum `x_prev`, ters kütle `w = 1/m`
  (`w = 0` → sabitlenmiş / pin).
- Bellek düzeni: **Struct-of-Arrays**, `Float32Array(3·N)` — `pos`, `prev`,
  `acc`; `Float32Array(N)` — `invMass`. Böylece konum dizisi doğrudan
  `BufferGeometry` `position` özniteliğine kopyalanabilir.

### 1.2 Yay türleri

| Tür | Bağlantı | Görevi | Komşu ofsetleri |
|---|---|---|---|
| **Structural** | yatay + dikey komşu | Gerilmeye direnç | `(1,0)`, `(0,1)` |
| **Shear** | çapraz komşu | Kayma / makaslamaya direnç | `(1,1)`, `(1,−1)` |
| **Bending** | 2 adım ötesi | Bükülmeye direnç | `(2,0)`, `(0,2)` |

Yay sayıları:

- Structural: `(n−1)·m + n·(m−1)`
- Shear: `2·(n−1)·(m−1)`
- Bending: `(n−2)·m + n·(m−2)`

Her yay: `a`, `b` indeksleri, dinlenme uzunluğu `L0`, sertlik `k`, sönüm `kd`,
tür etiketi. Saklama: `Uint32Array(2·S)` + `Float32Array(S)` (tür başına ayrı
diziler → türlere ayrı katsayı ve görünürlük vermek kolay).

### 1.3 Kuvvetler

Yay kuvveti (Hooke + sönüm), `d = x_b − x_a`, `l = |d|`, `u = d/l`:

```
F_a = ( k·(l − L0) + kd·((v_b − v_a)·u) ) · u ,   F_b = −F_a
```

Verlet'te hız örtüktür: `v ≈ (x − x_prev)/Δt`.

Dış kuvvetler:

- Yerçekimi `m·g`
- Rüzgâr: üçgen başına `F = c·(n̂·(v_rüzgar − v_üçgen))·n̂·A`, köşelere eşit
  dağıtılır; zamanla değişen gürültü (türbülans) seçeneği
- Hava sürtünmesi (global sönüm): Verlet'te `(x − x_prev)·(1 − damping)`

### 1.4 Verlet entegrasyonu (konum Verlet)

```
x_new  = x + (x − x_prev)·(1 − damping) + a·Δt²
x_prev = x
x      = x_new
```

- **Sabit adım** `Δt` (ör. 1/240 s) + biriktirici (accumulator): kare süresi
  ne olursa olsun fizik aynı adımla ilerler, sonuç deterministik olur.
- Kare başına `substeps` (varsayılan 4–8).

### 1.5 İki çözücü modu (seçilebilir)

1. **Kuvvet tabanlı (klasik kütle–yay):** yay kuvvetleri `a`'ya eklenir,
   Verlet ile ilerlenir. Yüksek `k`'da kararsızlaşır (`Δt < 2·√(m/k)`).
   Eğitim amaçlı, denklemlerle birebir.
2. **Kısıt tabanlı (Jakobsen / PBD tarzı):** Verlet adımından sonra her yay
   için mesafe kısıtı `iterations` kez düzeltilir:
   ```
   Δ = (l − L0)/l · d
   x_a += w_a/(w_a+w_b) · stiffness · Δ
   x_b −= w_b/(w_a+w_b) · stiffness · Δ
   ```
   Koşulsuz kararlı; tür başına `stiffness ∈ [0,1]` (structural ≈ 1,
   shear ≈ 0.5–0.9, bending ≈ 0.05–0.3).

Kararsızlık algılanırsa (NaN veya aşırı uzama) HUD'da uyarı + otomatik
duraklatma.

### 1.6 Kısıtlar ve çarpışmalar

- **Pin'ler:** üst kenar, iki üst köşe, sol kenar, hiç biri; fareyle tek
  parçacık sabitleme/bırakma.
- **Çarpışma:** zemin düzlemi, küre, kutu (konumu iterasyonda dışarı itme +
  basit sürtünme).
- **Yırtılma (opsiyonel):** `l > tearFactor·L0` olan yay silinir.
- **Self-collision:** kapsam dışı (ileride uzamsal hash ile).

---

## 2. Görselleştirme

- **Mesh:** `n × m` köşeli `BufferGeometry`, indeksli üçgenler; `uv = (x/(n−1),
  y/(m−1))` → doku doğrudan oturur.
- Her karede `position` güncellenir, `computeVertexNormals()` (veya kendi hızlı
  normal hesabı) çağrılır.
- **Doku (tekstür):**
  - Hazır desenler: ekose, çizgili, kanvas, bayrak (prosedürel `CanvasTexture`)
  - Kullanıcının yüklediği görsel (`<input type="file">` → `TextureLoader`)
  - `side: DoubleSide`, ön/arka yüz farklı renk seçeneği
  - Normal map ile dokuma hissi (opsiyonel)
- **Hata ayıklama katmanları** (ayrı ayrı açılıp kapanır):
  - Parçacıklar (`InstancedMesh` küçük küreler; pin'ler kırmızı)
  - Structural yaylar — mavi, Shear — yeşil, Bending — turuncu
    (`LineSegments`, her kare konumdan güncellenir)
  - Gerilme ısı haritası: yay rengi `(l − L0)/L0` ile maviden kırmızıya
- **Etkileşim:** fareyle parçacık yakalayıp sürükleme (raycast → en yakın
  köşe → geçici pin, imleç düzlemine taşınır).

---

## 3. Arayüz (araç paneli)

Sağ panel (mevcut `SidePanel` deseni), bölümler:

| Bölüm | Kontroller |
|---|---|
| Izgara | `n`, `m` (2–100), genişlik/yükseklik, başlangıç yönü (dikey/yatay) → **Yeniden oluştur** |
| Yaylar | her tür için aç/kapa, `k` (veya stiffness), `kd` |
| Çözücü | mod (kuvvet / kısıt), `Δt`, substeps, iterations, global damping |
| Kuvvetler | yerçekimi, rüzgâr yönü/şiddeti/türbülans |
| Kısıtlar | pin ön ayarları, yırtılma eşiği, çarpışma nesnesi |
| Görünüm | doku seçimi/yükleme, katman görünürlükleri, tel kafes |
| Hazır senaryolar | Bayrak, Perde, Masa örtüsü (küre üstüne düşen), Hamak, Yırtılan kumaş |

Alt çubuk: oynat/duraklat, tek adım, sıfırla, yavaş çekim (0.1×–1×).

HUD: parçacık/yay sayısı, fps, fizik ms/kare, toplam enerji (kinetik +
yay potansiyeli + yerçekimi), en büyük uzama %.

Denklemler paneli (`Equations.tsx` gibi KaTeX): Hooke, sönüm, Verlet ve
kısıt düzeltme formülleri, seçili moda göre vurgulu.

---

## 4. Animasyon kaydı / dışa aktarma

- **Video:** `canvas.captureStream()` + `MediaRecorder` → `.webm`
- **Kare dizisi:** sabit `Δt` ile çevrimdışı simülasyon, her kare PNG (zip)
- **Geometri:** son durum veya animasyon `.glb` (`GLTFExporter`, morph target
  / kare başına mesh) — Blender vb. araçlara aktarmak için
- **Senaryo dosyası:** tüm parametreler JSON olarak kaydet/yükle; URL'ye
  kodlanmış paylaşım bağlantısı

---

## 5. Kod yapısı

Mevcut Apophis uygulamasını bozmadan, Vite çok sayfalı yapı ile ikinci giriş
noktası: `kumas.html` → `src/cloth/main.tsx`.

```
kumas.html
src/cloth/
  main.tsx, App.tsx, store.ts        # zustand: parametreler + kontrol
  physics/
    grid.ts        # parçacık dizileri, ızgara üretimi, pin'ler
    springs.ts     # structural / shear / bending yay üretimi
    forces.ts      # yerçekimi, rüzgâr, yay kuvvetleri
    verlet.ts      # Verlet adımı, sabit adım biriktiricisi
    constraints.ts # mesafe kısıtları, çarpışma, yırtılma
    energy.ts      # enerji / gerilme ölçümleri
    ClothSim.ts    # hepsini birleştiren, React'ten bağımsız sınıf
  scene/
    ClothMesh.tsx, SpringLines.tsx, Particles.tsx, Colliders.tsx, useDrag.ts
  ui/
    ClothPanel.tsx, ClothHud.tsx, ClothEquations.tsx, Recorder.tsx
  textures/
    procedural.ts  # ekose, çizgili vb. CanvasTexture üretimi
scripts/check-cloth.ts                # node ile çalışan fizik testleri
```

İlke: **fizik çekirdeği saf TypeScript**, React/three'ye bağımlı değil → Node'da
test edilebilir, ileride Web Worker'a taşınabilir.

Simülasyon durumu zustand'a **konmaz** (her kare değişen büyük diziler);
zustand yalnızca parametreleri tutar. `ClothSim` örneği `useRef`'te durur,
`useFrame` içinde ilerletilir.

---

## 6. Testler (`scripts/check-cloth.ts`)

- Yay sayıları formüllerle eşleşiyor (ör. 10×10 → 180 / 162 / 160).
- Yerçekimsiz, dinlenme konumunda başlayan kumaş hareketsiz kalır.
- Tek serbest parçacık serbest düşüşte `½gt²`'ye yakınsar.
- Tek yay–kütle salınımının periyodu `2π√(m/k)`'ya yakın (kuvvet modu).
- Sönümsüz durumda enerji sapması sınırlı, sönümlü durumda monoton azalır.
- Pin'li parçacıklar yerinden oynamaz.
- Aynı parametre + aynı `Δt` → aynı sonuç (determinizm).

`npm test` bu dosyayı da çalıştıracak şekilde genişletilir.

---

## 7. Aşamalar

| # | Aşama | Çıktı |
|---|---|---|
| 1 | Fizik çekirdeği | grid + 3 yay türü + Verlet (kuvvet modu) + pin + testler |
| 2 | Temel sahne | `kumas.html`, kumaş mesh'i, düz renk, oynat/duraklat |
| 3 | Kısıt modu | PBD çözücü, iterations, mod seçimi |
| 4 | Doku ve hata ayıklama | prosedürel/yüklenen doku, yay/parçacık katmanları, gerilme haritası |
| 5 | Etkileşim ve kuvvetler | fareyle sürükleme, rüzgâr, çarpışma nesneleri, yırtılma |
| 6 | Araç paneli | tüm parametreler, hazır senaryolar, HUD, denklemler |
| 7 | Kayıt / dışa aktarma | WebM, PNG dizisi, GLB, JSON senaryo |
| 8 | Performans (gerekirse) | Web Worker + `SharedArrayBuffer`, veya WebGPU compute |

Performans hedefi: 50×50 (2 500 parçacık, ~14 500 yay) için ana iş
parçacığında 60 fps; 100×100 için Worker.

---

## 8. Açık sorular

1. Ayrı sayfa (`kumas.html`) mı, yoksa ayrı bir depo mu?
2. Varsayılan çözücü: eğitim amaçlı **kuvvet tabanlı** mı, kararlı
   **kısıt tabanlı** mı? (Öneri: kısıt tabanlı varsayılan, kuvvet modu seçenek.)
3. Kayıt çıktısı öncelikli olarak video mu, yoksa 3B (GLB) mi?
4. Self-collision gerekli mi?

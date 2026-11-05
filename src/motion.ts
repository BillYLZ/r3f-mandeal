/**
 * Telefon hareket sensörü (DeviceMotion).
 *
 * Cihaz eksenleri (ekran dik tutulurken): x → sağ, y → yukarı, z → ekrandan dışarı.
 *  - `shake`: yerçekimsiz doğrusal ivme [m/s²]. Tarayıcı vermezse
 *    accelerationIncludingGravity'den alçak geçiren süzgeçle yerçekimi çıkarılır.
 *  - `up`: yavaş süzülmüş accelerationIncludingGravity; dururken yukarıyı gösterir
 *    (ivmeölçer a − g ölçer, dururken −g = yukarı).
 * Değerler ekran yönüne (dikey/yatay) göre ekran eksenlerine döndürülür.
 */
export type Vec3 = [number, number, number]

export const motion = {
  active: false,
  shake: [0, 0, 0] as Vec3,
  up: [0, 9.81, 0] as Vec3,
  /** Son olayın zamanı (veri gelip gelmediğini anlamak için) */
  lastEvent: 0,
}

let lowpass: Vec3 = [0, 9.81, 0]

function toScreen(x: number, y: number, z: number): Vec3 {
  const angle = ((screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) * Math.PI) / 180
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [x * c - y * s, x * s + y * c, z]
}

function onMotion(e: DeviceMotionEvent) {
  const g = e.accelerationIncludingGravity
  if (!g || g.x == null || g.y == null || g.z == null) return
  const aig = toScreen(g.x, g.y, g.z)
  // Yerçekimi tahmini: yavaş alçak geçiren süzgeç
  for (let k = 0; k < 3; k++) lowpass[k] = lowpass[k] * 0.9 + aig[k] * 0.1
  motion.up = [...lowpass]

  const a = e.acceleration
  if (a && a.x != null && a.y != null && a.z != null) {
    motion.shake = toScreen(a.x, a.y, a.z)
  } else {
    motion.shake = [aig[0] - lowpass[0], aig[1] - lowpass[1], aig[2] - lowpass[2]]
  }
  motion.lastEvent = performance.now()
}

export const motionSupported = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window

/**
 * Sensörü başlat. iOS'ta izin yalnızca bir dokunma olayının içinden istenebilir,
 * bu yüzden bu fonksiyon bir düğmenin onClick'inden çağrılmalı.
 */
export async function startMotion(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (!motionSupported()) return 'unsupported'
  const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
  if (typeof DM.requestPermission === 'function') {
    try {
      if ((await DM.requestPermission()) !== 'granted') return 'denied'
    } catch {
      return 'denied'
    }
  }
  lowpass = [0, 9.81, 0]
  window.addEventListener('devicemotion', onMotion)
  motion.active = true
  return 'ok'
}

export function stopMotion() {
  window.removeEventListener('devicemotion', onMotion)
  motion.active = false
  motion.shake = [0, 0, 0]
  motion.up = [0, 9.81, 0]
}

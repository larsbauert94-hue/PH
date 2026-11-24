// Farbfilter als 4×5-Farbmatrizen (Skia ColorMatrix, Farbwerte 0–1).
// Die Filter tragen Namen aus der Getränkewelt; sie werden beim Speichern ins Bild gerechnet.

export type Matrix = number[] // 20 Werte, zeilenweise R, G, B, A

export const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]

/** a nach b anwenden: Ergebnis = a ∘ b */
export function concat(a: Matrix, b: Matrix): Matrix {
  const out: number[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c]
      out.push(v)
    }
  }
  return out
}
const chain = (...ms: Matrix[]) => ms.reduce((acc, m) => concat(m, acc), IDENTITY)

export function saturation(s: number): Matrix {
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722]
  const sr = (1 - s) * lr, sg = (1 - s) * lg, sb = (1 - s) * lb
  return [sr + s, sg, sb, 0, 0, sr, sg + s, sb, 0, 0, sr, sg, sb + s, 0, 0, 0, 0, 0, 1, 0]
}
export const brightness = (b: number): Matrix => [1, 0, 0, 0, b, 0, 1, 0, 0, b, 0, 0, 1, 0, b, 0, 0, 0, 1, 0]
export function contrast(c: number): Matrix {
  const t = 0.5 * (1 - c)
  return [c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0]
}
/** positiv = wärmer (mehr Rot/Gelb), negativ = kühler */
export const warmth = (w: number): Matrix => [1 + w * 0.12, 0, 0, 0, w * 0.02, 0, 1 + w * 0.03, 0, 0, 0, 0, 0, 1 - w * 0.14, 0, 0, 0, 0, 0, 1, 0]
export const tint = (r: number, g: number, b: number): Matrix => [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0]
/** hebt die Schwarztöne an (matter Look) */
export const fade = (f: number): Matrix => [1 - f, 0, 0, 0, f * 0.35, 0, 1 - f, 0, 0, f * 0.35, 0, 0, 1 - f, 0, f * 0.35, 0, 0, 0, 1, 0]
export const sepia = (k: number): Matrix => lerp(IDENTITY, [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0], k)

export function lerp(a: Matrix, b: Matrix, k: number): Matrix {
  return a.map((v, i) => v + (b[i] - v) * k)
}

export interface FilterPreset { id: string; name: string; matrix: Matrix }

export const FILTERS: FilterPreset[] = [
  { id: 'original', name: 'Original', matrix: IDENTITY },
  { id: 'rose', name: 'Rosé', matrix: chain(warmth(0.3), tint(0.04, -0.01, 0.03), saturation(1.08), fade(0.06)) },
  { id: 'bordeaux', name: 'Bordeaux', matrix: chain(contrast(1.15), tint(0.05, -0.02, -0.01), saturation(1.2), brightness(-0.03)) },
  { id: 'champagner', name: 'Champagner', matrix: chain(brightness(0.05), warmth(0.5), saturation(0.9), fade(0.08)) },
  { id: 'whisky', name: 'Whisky', matrix: chain(sepia(0.45), contrast(1.12), warmth(0.5)) },
  { id: 'gin', name: 'Gin', matrix: chain(warmth(-0.55), tint(-0.02, 0.03, 0.04), saturation(1.05), brightness(0.02)) },
  { id: 'noir', name: 'Noir', matrix: chain(saturation(0), contrast(1.3)) },
  { id: 'vintage', name: 'Vintage', matrix: chain(sepia(0.3), fade(0.14), contrast(0.92)) },
  { id: 'neon', name: 'Neon', matrix: chain(saturation(1.55), contrast(1.15)) },
  { id: 'kellerlicht', name: 'Kellerlicht', matrix: chain(brightness(-0.07), contrast(1.22), warmth(0.35)) },
  { id: 'morgen', name: 'Morgen', matrix: chain(brightness(0.08), contrast(0.9), saturation(0.95), warmth(-0.15)) },
  { id: 'absinth', name: 'Absinth', matrix: chain(tint(-0.03, 0.05, -0.02), saturation(1.2), contrast(1.05)) },
]

export interface Adjustments { brightness: number; contrast: number; saturation: number; warmth: number; fade: number }
export const NO_ADJUST: Adjustments = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0 }

export const ADJUST_LABELS: { key: keyof Adjustments; label: string; icon: string; min: number }[] = [
  { key: 'brightness', label: 'Helligkeit', icon: 'sunny-outline', min: -100 },
  { key: 'contrast', label: 'Kontrast', icon: 'contrast-outline', min: -100 },
  { key: 'saturation', label: 'Sättigung', icon: 'color-palette-outline', min: -100 },
  { key: 'warmth', label: 'Wärme', icon: 'thermometer-outline', min: -100 },
  { key: 'fade', label: 'Verblassen', icon: 'cloud-outline', min: 0 },
]

/** Gesamtmatrix: Filter mit Stärke (0–1), danach Anpassungen (Regler −100…100) */
export function buildMatrix(filterId: string, strength: number, a: Adjustments): Matrix {
  const preset = FILTERS.find(f => f.id === filterId) ?? FILTERS[0]
  return chain(
    lerp(IDENTITY, preset.matrix, strength),
    brightness(a.brightness / 400),
    contrast(1 + a.contrast / 200),
    saturation(1 + a.saturation / 100),
    warmth(a.warmth / 100),
    fade(a.fade / 250),
  )
}

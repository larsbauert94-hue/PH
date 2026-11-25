import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

/** Kartenkacheln für die Web-Version, mit automatischem Ausweichen auf weitere Anbieter */
export const TILE = 256

type Provider = { url: (z: number, x: number, y: number) => string; attribution: string; filter?: string }

const PROVIDERS: Provider[] = [
  // Dunkle, elegante Karte mit Straßennamen (frei mit Namensnennung)
  { url: (z, x, y) => `https://${'abcd'[(x + y) & 3]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}@2x.png`, attribution: '© OpenStreetMap · © CARTO' },
  // Ausweichen 1: Esri „Dark Gray Canvas“
  { url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}`, attribution: '© Esri · HERE · OpenStreetMap' },
  // Ausweichen 2 und 3: OpenStreetMap (international und deutscher Server), per Filter abgedunkelt
  { url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, attribution: '© OpenStreetMap', filter: 'invert(1) hue-rotate(195deg) brightness(0.85) saturate(0.45) contrast(0.9)' },
  { url: (z, x, y) => `https://tile.openstreetmap.de/${z}/${x}/${y}.png`, attribution: '© OpenStreetMap Deutschland', filter: 'invert(1) hue-rotate(195deg) brightness(0.85) saturate(0.45) contrast(0.9)' },
]

/** Web-Mercator: Breite/Länge → Weltpixel bei Zoom z */
export function toWorld(lat: number, lng: number, z: number) {
  const s = TILE * 2 ** z
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }
}
export function toLatLng(x: number, y: number, z: number) {
  const s = TILE * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / s
  return { latitude: (180 / Math.PI) * Math.atan(Math.sinh(n)), longitude: (x / s) * 360 - 180 }
}

/**
 * Zeichnet die sichtbaren Kacheln für Mittelpunkt und Zoom. Lädt eine Kachel nicht,
 * kommt sie vom nächsten Anbieter; die Namensnennung folgt dem genutzten Anbieter.
 */
export function TileLayer({ lat, lng, z, width, height }: { lat: number; lng: number; z: number; width: number; height: number }) {
  // Anbieter je Kachel (steigt bei Ladefehlern)
  const [provider, setProvider] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const [errors, setErrors] = useState(0)
  // Lädt nach einigen Sekunden gar nichts, zeigen wir einen Hinweis statt einer leeren Fläche
  const [slow, setSlow] = useState(false)
  useEffect(() => { const id = setTimeout(() => setSlow(true), 7000); return () => clearTimeout(id) }, [])
  if (!width || !height) return null

  const tz = Math.max(0, Math.floor(z))
  const scale = 2 ** (z - tz)
  const ts = TILE * scale
  const c = toWorld(lat, lng, tz)
  const x0 = Math.floor((c.x - width / 2 / scale) / TILE)
  const x1 = Math.floor((c.x + width / 2 / scale) / TILE)
  const y0 = Math.floor((c.y - height / 2 / scale) / TILE)
  const y1 = Math.floor((c.y + height / 2 / scale) / TILE)
  const n = 2 ** tz
  const tiles: { key: string; url: string; p: number; left: number; top: number }[] = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= n) continue
    const key = `${tz}/${x}/${y}`
    const p = provider[key] ?? 0
    if (p >= PROVIDERS.length) continue
    tiles.push({ key, url: PROVIDERS[p].url(tz, ((x % n) + n) % n, y), p, left: (x * TILE - c.x) * scale + width / 2, top: (y * TILE - c.y) * scale + height / 2 })
  }
  const used = [...new Set(tiles.map(t => t.p))].filter(p => loaded[p])

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tiles.map(t => (
        <Image
          key={`${t.key}-${t.p}`}
          source={{ uri: t.url }}
          onLoad={() => { if (!loaded[t.p]) setLoaded(l => ({ ...l, [t.p]: true })) }}
          onError={() => { setErrors(n => n + 1); setProvider(m => ({ ...m, [t.key]: (m[t.key] ?? 0) + 1 })) }}
          style={[{ position: 'absolute', left: t.left, top: t.top, width: ts + 0.6, height: ts + 0.6 }, PROVIDERS[t.p].filter ? ({ filter: PROVIDERS[t.p].filter } as object) : null]}
        />
      ))}
      {/* leichte Nachtblau-Tönung, damit die Karte zum App-Design passt */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,16,41,0.18)' }]} />
      {used.length > 0 && <Text style={st.attr}>{used.map(p => PROVIDERS[p].attribution).join(' · ')}</Text>}
      {slow && used.length === 0 && (
        <View style={st.notice}>
          <Text style={st.noticeTitle}>Kartenbilder werden nicht geladen</Text>
          <Text style={st.noticeText}>{errors ? `${errors} Anfragen abgelehnt` : 'Keine Antwort der Kartenserver'}. Prüfe die Internetverbindung oder Inhaltsblocker in den Safari-Einstellungen.</Text>
        </View>
      )}
    </View>
  )
}

/** Tropfen-Pin in der Farbe der Ortsart */
export function DropPin({ color, size = 30, selected = false }: { color: string; size?: number; selected?: boolean }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 24 30">
      <Path d="M12 1.5C6.5 1.5 2.5 5.6 2.5 10.8c0 6.9 9.5 16.7 9.5 16.7s9.5-9.8 9.5-16.7C21.5 5.6 17.5 1.5 12 1.5z" fill={color} stroke={selected ? '#f3ede6' : '#0b1029'} strokeWidth={selected ? 2.2 : 1.6} />
      <Circle cx={12} cy={10.8} r={3.6} fill="#0b1029" opacity={0.85} />
    </Svg>
  )
}

const st = StyleSheet.create({
  notice: { position: 'absolute', left: 24, right: 24, top: '42%', padding: 14, borderRadius: 14, backgroundColor: 'rgba(11,16,41,0.9)', borderWidth: 1, borderColor: 'rgba(227,165,133,0.4)', gap: 4 },
  noticeTitle: { color: '#f3ede6', fontWeight: '700', textAlign: 'center' },
  noticeText: { color: 'rgba(243,237,230,0.7)', fontSize: 12, textAlign: 'center' },
  attr: { position: 'absolute', left: 8, bottom: 4, color: 'rgba(255,255,255,0.55)', fontSize: 9, backgroundColor: 'rgba(11,16,41,0.5)', paddingHorizontal: 4, borderRadius: 4 },
})

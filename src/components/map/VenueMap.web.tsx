import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { VENUE_TYPES } from '../../lib/labels'
import { colors } from '../../lib/theme'
import { GERMANY, type Coords } from '../../lib/geo'
import type { Venue } from '../../lib/types'
import type { VenueMapHandle } from './VenueMap'

interface Props {
  venues: Venue[]
  selectedId: string | null
  onSelect(id: string | null): void
  showsUserLocation: boolean
  userLocation?: Coords | null
  /** Radius um den Standort, der als Kreis gezeigt wird (km) */
  radiusKm?: number
}

// Kartenbilder: dunkel und elegant; lädt ein Anbieter nicht, kommt der nächste
const LAYERS: { url: string; subdomains?: string; attribution: string; className?: string }[] = [
  { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', subdomains: 'abcd', attribution: '© OpenStreetMap · © CARTO' },
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri · HERE · OpenStreetMap' },
  { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap', className: 'pour-dim' },
  { url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', attribution: '© OpenStreetMap Deutschland', className: 'pour-dim' },
]

// Eigene Darstellung: Tropfen-Pins, Namensschild, abgedunkelte OSM-Kacheln, Leaflet-Bedienelemente passend zur App
const CSS = `
.pour-map { background: #0f1634; font-family: system-ui, -apple-system, sans-serif; }
.pour-map .leaflet-control-attribution { background: rgba(11,16,41,0.6); color: rgba(255,255,255,0.6); font-size: 9px; border-radius: 4px 0 0 0; }
.pour-map .leaflet-control-attribution a { color: #eeb999; }
.pour-dim { filter: invert(1) hue-rotate(195deg) brightness(0.85) saturate(0.45) contrast(0.9); }
.pour-pin { background: none; border: none; }
.pour-pin .lbl { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 2px; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis;
  padding: 3px 8px; border-radius: 999px; background: rgba(11,16,41,0.88); border: 1px solid rgba(227,165,133,0.35); color: #f3ede6; font: 700 11px system-ui, sans-serif; }
.pour-pin.sel .lbl { background: #e3a585; border-color: #e3a585; color: #0b1029; }
.pour-pin svg { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
.pour-me { width: 16px; height: 16px; border-radius: 8px; background: #4f8cff; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(79,140,255,0.25); }
`

function pinIcon(v: Venue, selected: boolean, showLabel: boolean) {
  const w = selected ? 38 : 30
  const color = VENUE_TYPES[v.type].color
  const name = v.name.replace(/[<>&"]/g, '')
  return L.divIcon({
    className: `pour-pin${selected ? ' sel' : ''}`,
    iconSize: [w, w * 1.25],
    iconAnchor: [w / 2, w * 1.25],
    html: `<svg width="${w}" height="${w * 1.25}" viewBox="0 0 24 30" aria-label="${name}"><path d="M12 1.5C6.5 1.5 2.5 5.6 2.5 10.8c0 6.9 9.5 16.7 9.5 16.7s9.5-9.8 9.5-16.7C21.5 5.6 17.5 1.5 12 1.5z" fill="${color}" stroke="${selected ? '#f3ede6' : '#0b1029'}" stroke-width="${selected ? 2.2 : 1.6}"/><circle cx="12" cy="10.8" r="3.6" fill="#0b1029" opacity="0.85"/></svg>${showLabel ? `<div class="lbl">${name}</div>` : ''}`,
  })
}

/**
 * Web-Karte mit Leaflet: dunkle Kartenbilder, Ziehen und Zwei-Finger-Zoom, Tropfen-Pins je Ortsart,
 * Kreis um den eigenen Standort. Auf iPhone/Android zeigt die App Apple bzw. Google Maps.
 */
const VenueMap = forwardRef<VenueMapHandle, Props>(function VenueMap({ venues, selectedId, onSelect, userLocation, radiusKm = 20 }, ref) {
  // DOM-Knoten der Karte (react-native-web rendert View als div)
  const host = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.LayerGroup | null>(null)
  const select = useRef(onSelect)
  const [zoom, setZoom] = useState(6)
  const [failed, setFailed] = useState(false)
  useEffect(() => { select.current = onSelect })

  // Karte einmalig anlegen
  useEffect(() => {
    const el = host.current
    if (!el || map.current) return
    if (!document.getElementById('pour-map-css')) {
      const style = document.createElement('style')
      style.id = 'pour-map-css'
      style.textContent = CSS
      document.head.appendChild(style)
    }
    el.classList.add('pour-map')
    const m = L.map(el, { zoomControl: false, attributionControl: true, center: [GERMANY.latitude, GERMANY.longitude], zoom: 6, minZoom: 4, maxZoom: 18, zoomSnap: 0.25 })
    m.attributionControl.setPrefix(false)
    map.current = m
    markers.current = L.layerGroup().addTo(m)
    me.current = L.layerGroup().addTo(m)
    m.on('click', () => select.current(null))
    m.on('zoomend', () => setZoom(m.getZoom()))

    // Kartenbilder mit Ausweichen auf den nächsten Anbieter
    let index = 0
    let errors = 0
    let loadedAny = false
    let layer: L.TileLayer
    const use = (i: number) => {
      const cfg = LAYERS[i]
      layer = L.tileLayer(cfg.url, { subdomains: cfg.subdomains ?? 'abc', attribution: cfg.attribution, className: cfg.className, maxZoom: 19, detectRetina: false, crossOrigin: false })
      layer.on('tileload', () => { loadedAny = true; setFailed(false) })
      layer.on('tileerror', () => {
        errors++
        if (!loadedAny && errors >= 4 && index < LAYERS.length - 1) {
          m.removeLayer(layer); index++; errors = 0; use(index)
        } else if (!loadedAny && index >= LAYERS.length - 1 && errors >= 4) setFailed(true)
      })
      layer.addTo(m)
    }
    use(0)
    const timer = setTimeout(() => { if (!loadedAny) setFailed(true) }, 9000)
    // Größe nach dem ersten Layout neu messen (Tab-Wechsel, Drehen)
    const resize = new ResizeObserver(() => m.invalidateSize())
    resize.observe(el)
    return () => { clearTimeout(timer); resize.disconnect(); m.remove(); map.current = null }
  }, [])

  // Pins aktualisieren
  const showLabels = zoom >= 12
  useEffect(() => {
    const g = markers.current
    if (!g) return
    g.clearLayers()
    for (const v of venues) {
      const sel = v.id === selectedId
      L.marker([v.latitude, v.longitude], { icon: pinIcon(v, sel, showLabels || sel), zIndexOffset: sel ? 1000 : 0, keyboard: true, title: `${v.name}, ${v.city}` })
        .on('click', e => { L.DomEvent.stopPropagation(e); select.current(v.id) })
        .addTo(g)
    }
  }, [venues, selectedId, showLabels])

  // Eigener Standort mit Umkreis
  useEffect(() => {
    const g = me.current
    if (!g) return
    g.clearLayers()
    if (!userLocation) return
    const ll: L.LatLngExpression = [userLocation.latitude, userLocation.longitude]
    L.circle(ll, { radius: radiusKm * 1000, color: '#e3a585', weight: 1.5, opacity: 0.7, fillColor: '#e3a585', fillOpacity: 0.06, interactive: false }).addTo(g)
    L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pour-me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(g)
  }, [userLocation, radiusKm])

  useImperativeHandle(ref, () => ({
    // zoom = Nord-Süd-Ausdehnung in Grad
    focus: (c: Coords, span = 0.05) => {
      const half = span / 2
      const lng = half / Math.cos((c.latitude * Math.PI) / 180)
      map.current?.flyToBounds([[c.latitude - half, c.longitude - lng], [c.latitude + half, c.longitude + lng]], { duration: 0.6, padding: [8, 8] })
    },
    zoomBy: (d: number) => { if (d > 0) map.current?.zoomIn(); else map.current?.zoomOut() },
  }))

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
      {/* eigene Ebene, damit Leaflets Ebenen nicht über Suche und Knöpfe liegen */}
      <View ref={host as never} style={[StyleSheet.absoluteFill, { zIndex: 0 }]} />
      {failed && (
        <View style={st.notice} pointerEvents="none">
          <Text style={st.noticeTitle}>Kartenbilder werden nicht geladen</Text>
          <Text style={st.noticeText}>Die Kartenserver antworten nicht. Prüfe die Internetverbindung oder Inhaltsblocker in den Safari-Einstellungen.</Text>
        </View>
      )}
    </View>
  )
})

export default VenueMap

const st = StyleSheet.create({
  notice: { position: 'absolute', left: 24, right: 24, top: '42%', padding: 14, borderRadius: 14, backgroundColor: 'rgba(11,16,41,0.92)', borderWidth: 1, borderColor: 'rgba(227,165,133,0.4)', gap: 4, zIndex: 1000 },
  noticeTitle: { color: colors.text, fontWeight: '700', textAlign: 'center' },
  noticeText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
})

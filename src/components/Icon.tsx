import type { ComponentProps } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle, Path } from 'react-native-svg'

/**
 * Eigenes Linien-Iconset von Pour: feine 1,6er-Linien, runde Enden, kleine eigene Details
 * (Torbogen am Haus, Tropfen beim Posten, Etikett-Loch am Merken-Zeichen, Weiterleiten-Pfeil
 * statt Papierflieger). Namen folgen Ionicons; was hier nicht gezeichnet ist, kommt als
 * Ionicons-Umriss.
 */
export type IconName = ComponentProps<typeof Ionicons>['name']

type Shape = { d: string; fill?: boolean } | { c: [number, number, number]; fill?: boolean }
interface Def { shapes: Shape[]; /** Wird bei Namen ohne „-outline“ gefüllt */ solid?: boolean }

const pin = 'M12 21.2s-6.6-6.1-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5-6.6 11.1-6.6 11.1z'
const heart = 'M12 19.6S4 14.9 4 9.5A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 8 1.5c0 5.4-8 10.1-8 10.1z'
const bubble = 'M6 4.8h12a2.4 2.4 0 0 1 2.4 2.4v7.2a2.4 2.4 0 0 1-2.4 2.4h-7.4L6.4 20v-3.2H6a2.4 2.4 0 0 1-2.4-2.4V7.2A2.4 2.4 0 0 1 6 4.8z'
const drop = 'M12 3.2s-6.4 6.9-6.4 11.4a6.4 6.4 0 0 0 12.8 0C18.4 10.1 12 3.2 12 3.2z'
const tag = 'M7.2 3.4h9.6a1.2 1.2 0 0 1 1.2 1.2v16l-6-3.9-6 3.9v-16a1.2 1.2 0 0 1 1.2-1.2z'
const person = (x: number, s = 1): Shape[] => [{ c: [x, 8.2, 3.5 * s] }, { d: `M${x - 7 * s} 20.4a${7 * s} ${7 * s} 0 0 1 ${14 * s} 0` }]

const ICONS: Record<string, Def> = {
  home: { shapes: [{ d: 'M3.8 10.6 12 4l8.2 6.6v8.6a1.4 1.4 0 0 1-1.4 1.4H5.2a1.4 1.4 0 0 1-1.4-1.4z' }, { d: 'M9.8 20.6v-4.2a2.2 2.2 0 0 1 4.4 0v4.2' }] },
  search: { shapes: [{ c: [10.6, 10.6, 6.4] }, { d: 'M15.3 15.3 20.2 20.2' }, { d: 'M7.9 9.4a3 3 0 0 1 2.2-1.9' }] },
  /** Tropfen mit Plus: „Posten“ */
  water: { shapes: [{ d: drop }, { d: 'M12 11.2v6.4M8.8 14.4h6.4' }] },
  add: { shapes: [{ d: 'M12 5v14M5 12h14' }] },
  'add-circle-outline': { shapes: [{ c: [12, 12, 8.6] }, { d: 'M12 8.2v7.6M8.2 12h7.6' }] },
  film: { shapes: [{ d: 'M8.6 3h6.8A2.6 2.6 0 0 1 18 5.6v12.8a2.6 2.6 0 0 1-2.6 2.6H8.6A2.6 2.6 0 0 1 6 18.4V5.6A2.6 2.6 0 0 1 8.6 3z' }, { d: 'M10.6 9.4 14.6 12l-4 2.6z', fill: true }] },
  videocam: { shapes: [{ d: 'M4.4 7h9.2A1.4 1.4 0 0 1 15 8.4v7.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 15.6V8.4A1.4 1.4 0 0 1 4.4 7z' }, { d: 'm15 10.6 6-3.2v9.2l-6-3.2' }] },
  play: { shapes: [{ d: 'M8 5.2 18.4 12 8 18.8z', fill: true }] },
  'play-circle': { shapes: [{ c: [12, 12, 9] }, { d: 'M10.2 8.6 15.4 12l-5.2 3.4z', fill: true }] },
  map: { shapes: [{ d: 'm3.6 6.6 5.6-2.2 5.6 2.2 5.6-2.2v13l-5.6 2.2-5.6-2.2-5.6 2.2z' }, { d: 'M9.2 4.4v13M14.8 6.6v13' }] },
  location: { solid: true, shapes: [{ d: pin }, { c: [12, 10.1, 2.3] }] },
  navigate: { solid: true, shapes: [{ d: 'M4 11.2 20 4l-7.2 16-1.9-6.9z' }] },
  locate: { shapes: [{ c: [12, 12, 6.6] }, { c: [12, 12, 1.8], fill: true }, { d: 'M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8' }] },
  heart: { solid: true, shapes: [{ d: heart }] },
  chatbubble: { solid: true, shapes: [{ d: bubble }] },
  'chatbubble-ellipses': { solid: true, shapes: [{ d: bubble }, { c: [8.4, 10.8, 0.9], fill: true }, { c: [12, 10.8, 0.9], fill: true }, { c: [15.6, 10.8, 0.9], fill: true }] },
  chatbubbles: { shapes: [{ d: 'M5 3.6h9.6a2 2 0 0 1 2 2v5.6a2 2 0 0 1-2 2H9l-3.4 2.6v-2.6H5a2 2 0 0 1-2-2V5.6a2 2 0 0 1 2-2z' }, { d: 'M19 8.8a2 2 0 0 1 2 2v5.6a2 2 0 0 1-2 2h-.6V21L15 18.4h-4.2a2 2 0 0 1-2-1.6' }] },
  'paper-plane': { shapes: [{ d: 'M14.4 5.2 20.4 11l-6 5.8' }, { d: 'M20.2 11H10.6a6.4 6.4 0 0 0-6.4 6.4v1.4' }] },
  send: { shapes: [{ d: 'M14.4 5.2 20.4 11l-6 5.8' }, { d: 'M20.2 11H10.6a6.4 6.4 0 0 0-6.4 6.4v1.4' }] },
  share: { shapes: [{ d: 'M12 14.6V3.6M8 7.4l4-3.8 4 3.8' }, { d: 'M8.4 10.4H6.6A1.6 1.6 0 0 0 5 12v7a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19v-7a1.6 1.6 0 0 0-1.6-1.6h-1.8' }] },
  bookmark: { solid: true, shapes: [{ d: tag }, { c: [12, 7.6, 1.1] }] },
  notifications: { solid: true, shapes: [{ d: 'M6.2 16.6v-5.4a5.8 5.8 0 0 1 11.6 0v5.4l1.6 1.8H4.6z' }, { d: 'M10 20.6a2.1 2.1 0 0 0 4 0' }] },
  'ellipsis-horizontal': { shapes: [{ c: [5.6, 12, 1.25], fill: true }, { c: [12, 12, 1.25], fill: true }, { c: [18.4, 12, 1.25], fill: true }] },
  close: { shapes: [{ d: 'M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6' }] },
  'close-circle': { solid: true, shapes: [{ c: [12, 12, 9] }, { d: 'M9.2 9.2 14.8 14.8M14.8 9.2 9.2 14.8' }] },
  'chevron-back': { shapes: [{ d: 'M14.8 5.2 8 12l6.8 6.8' }] },
  'chevron-forward': { shapes: [{ d: 'M9.2 5.2 16 12l-6.8 6.8' }] },
  'chevron-down': { shapes: [{ d: 'M5.2 9.2 12 16l6.8-6.8' }] },
  'arrow-up': { shapes: [{ d: 'M12 19.6V4.6M6.4 10.2 12 4.6l5.6 5.6' }] },
  'arrow-forward-circle': { solid: true, shapes: [{ c: [12, 12, 9] }, { d: 'M7.6 12h8.6M12.8 8.4l3.6 3.6-3.6 3.6' }] },
  camera: { shapes: [{ d: 'M4 8.4A2 2 0 0 1 6 6.4h2.2l1.6-2.2h4.4l1.6 2.2H18a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' }, { c: [12, 12.8, 3.6] }] },
  image: { shapes: [{ d: 'M6 4.8h12A2.4 2.4 0 0 1 20.4 7.2v9.6A2.4 2.4 0 0 1 18 19.2H6a2.4 2.4 0 0 1-2.4-2.4V7.2A2.4 2.4 0 0 1 6 4.8z' }, { d: 'm3.8 16.2 4.8-4.4 3.8 3.4 2.8-2.4 4.8 4.2' }, { c: [15.4, 9.2, 1.4] }] },
  images: { shapes: [{ d: 'M8 7.2h11a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2z' }, { d: 'm6.2 17.2 4.2-3.8 3.4 3 2.4-2 4.6 3.8' }, { d: 'M3 15.8V6a2 2 0 0 1 2-2h11.2' }] },
  'musical-notes': { shapes: [{ d: 'M9 17.2V6.2l10.4-2.2v11' }, { c: [6.8, 17.4, 2.2] }, { c: [17.2, 15.2, 2.2] }] },
  person: { solid: true, shapes: person(12) },
  'person-add': { shapes: [...person(10, 0.95), { d: 'M19 7.4v5.2M16.4 10h5.2' }] },
  people: { shapes: [{ c: [9, 8.4, 3.2] }, { d: 'M2.8 20.2a6.2 6.2 0 0 1 12.4 0' }, { d: 'M15.2 5.4a3.2 3.2 0 0 1 0 6.2M17.4 14.4a6.2 6.2 0 0 1 3.8 5.8' }] },
  settings: { shapes: [{ d: 'M4 7.4h9.6M18.4 7.4H20M4 16.6h3.6M12.4 16.6H20' }, { c: [16, 7.4, 2.4] }, { c: [10, 16.6, 2.4] }] },
  grid: { shapes: [{ d: 'M5.4 4h4.2A1.4 1.4 0 0 1 11 5.4v4.2A1.4 1.4 0 0 1 9.6 11H5.4A1.4 1.4 0 0 1 4 9.6V5.4A1.4 1.4 0 0 1 5.4 4zM14.4 4h4.2A1.4 1.4 0 0 1 20 5.4v4.2a1.4 1.4 0 0 1-1.4 1.4h-4.2A1.4 1.4 0 0 1 13 9.6V5.4A1.4 1.4 0 0 1 14.4 4zM5.4 13h4.2a1.4 1.4 0 0 1 1.4 1.4v4.2A1.4 1.4 0 0 1 9.6 20H5.4A1.4 1.4 0 0 1 4 18.6v-4.2A1.4 1.4 0 0 1 5.4 13zM14.4 13h4.2a1.4 1.4 0 0 1 1.4 1.4v4.2a1.4 1.4 0 0 1-1.4 1.4h-4.2a1.4 1.4 0 0 1-1.4-1.4v-4.2a1.4 1.4 0 0 1 1.4-1.4z' }] },
  wine: { shapes: [{ d: 'M7.6 3.4h8.8l-.4 5.2a4 4 0 0 1-8 0z' }, { d: 'M12 12.6v7.6M8.4 20.4h7.2' }, { d: 'M8 7.4h8' }] },
  sparkles: { solid: true, shapes: [{ d: 'M11 3.6c.6 3.8 2 5.2 5.8 5.8-3.8.6-5.2 2-5.8 5.8-.6-3.8-2-5.2-5.8-5.8 3.8-.6 5.2-2 5.8-5.8z' }, { d: 'M18 14.4c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z' }] },
  calendar: { shapes: [{ d: 'M6 5.4h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z' }, { d: 'M4 10h16M8.4 3.4v3.6M15.6 3.4v3.6' }] },
  briefcase: { shapes: [{ d: 'M5 7.6h14a1.8 1.8 0 0 1 1.8 1.8v8.8a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8V9.4A1.8 1.8 0 0 1 5 7.6z' }, { d: 'M9 7.6V5.8A1.6 1.6 0 0 1 10.6 4.2h2.8A1.6 1.6 0 0 1 15 5.8v1.8M3.2 13h17.6' }] },
  trash: { shapes: [{ d: 'M4.6 6.6h14.8M9.6 6.6V4.8h4.8v1.8' }, { d: 'm6.4 6.6.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.9-12.2' }] },
  link: { shapes: [{ d: 'M10.4 13.6a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1' }, { d: 'M13.6 10.4a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1' }] },
  mail: { shapes: [{ d: 'M5 5.6h14a1.8 1.8 0 0 1 1.8 1.8v9.2a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8V7.4A1.8 1.8 0 0 1 5 5.6z' }, { d: 'm3.8 7 8.2 6 8.2-6' }] },
  eye: { shapes: [{ d: 'M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12z' }, { c: [12, 12, 2.8] }] },
  storefront: { shapes: [{ d: 'M4 9.4 5.4 4.6h13.2L20 9.4a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0 2.7 2.7 0 0 1-5.3 0z' }, { d: 'M5.4 12v7.4h13.2V12M10 19.4v-4.2h4v4.2' }] },
  restaurant: { shapes: [{ d: 'M7 3.6v16.8M4.6 3.6v4.6a2.4 2.4 0 0 0 4.8 0V3.6' }, { d: 'M17 20.4V3.6c-2.4 1.2-3.4 4-3.4 7.4H17' }] },
  cube: { shapes: [{ d: 'm12 3.2 7.8 4.4v8.8L12 20.8l-7.8-4.4V7.6z' }, { d: 'M4.2 7.6 12 12l7.8-4.4M12 12v8.8' }] },
  ribbon: { shapes: [{ c: [12, 9, 5.4] }, { d: 'm8.6 13.2-1.6 7.2 5-2.6 5 2.6-1.6-7.2' }] },
  pricetag: { shapes: [{ d: 'M3.6 4.8v6.4l8.6 8.6a1.6 1.6 0 0 0 2.3 0l5.3-5.3a1.6 1.6 0 0 0 0-2.3L11.2 3.6H4.8a1.2 1.2 0 0 0-1.2 1.2z' }, { c: [8, 8, 1.4] }] },
  'log-out': { shapes: [{ d: 'M14 4.4H6.4A1.6 1.6 0 0 0 4.8 6v12a1.6 1.6 0 0 0 1.6 1.6H14' }, { d: 'M10 12h10.4M17 8.6l3.4 3.4-3.4 3.4' }] },
  copy: { shapes: [{ d: 'M9.6 8.4h8.2A1.8 1.8 0 0 1 19.6 10.2v8.2a1.8 1.8 0 0 1-1.8 1.8H9.6a1.8 1.8 0 0 1-1.8-1.8v-8.2A1.8 1.8 0 0 1 9.6 8.4z' }, { d: 'M15.8 8.4V6a1.8 1.8 0 0 0-1.8-1.8H6.2A1.8 1.8 0 0 0 4.4 6v7.8a1.8 1.8 0 0 0 1.8 1.8h1.6' }] },
  'checkmark-circle': { solid: true, shapes: [{ c: [12, 12, 9] }, { d: 'm8.2 12.2 2.6 2.6 5-5.2' }] },
  checkmark: { shapes: [{ d: 'm5.4 12.6 4.4 4.4 8.8-9.6' }] },
  newspaper: { shapes: [{ d: 'M5.4 4.6h13.2a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V6.2a1.6 1.6 0 0 1 1.6-1.6z' }, { d: 'M7.4 8.6h9.2M7.4 12h9.2M7.4 15.4h5.6' }] },
  'volume-high': { shapes: [{ d: 'M4 9.4h3.2L12 5.4v13.2l-4.8-4H4z' }, { d: 'M15.4 9a4.4 4.4 0 0 1 0 6M18 6.6a8 8 0 0 1 0 10.8' }] },
  'volume-mute': { shapes: [{ d: 'M4 9.4h3.2L12 5.4v13.2l-4.8-4H4z' }, { d: 'm15.6 9.6 4.8 4.8M20.4 9.6l-4.8 4.8' }] },
  at: { shapes: [{ c: [12, 12, 3.6] }, { d: 'M15.6 12v1.4a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.6 7.1' }] },
  text: { shapes: [{ d: 'M5.4 6.4V4.8h13.2v1.6M12 4.8v14.4M9.2 19.2h5.6' }] },
  globe: { shapes: [{ c: [12, 12, 8.8] }, { d: 'M3.2 12h17.6M12 3.2c2.4 2.6 3.6 5.6 3.6 8.8s-1.2 6.2-3.6 8.8c-2.4-2.6-3.6-5.6-3.6-8.8s1.2-6.2 3.6-8.8z' }] },
  call: { shapes: [{ d: 'M6.6 3.8h2.6l1.4 4-2 1.4a10.6 10.6 0 0 0 5.2 5.2l1.4-2 4 1.4V16a2.6 2.6 0 0 1-2.8 2.6A14.4 14.4 0 0 1 4 6.6a2.6 2.6 0 0 1 2.6-2.8z' }] },
}

export function Icon({ name, size = 24, color = '#fff', style, accessibilityLabel }: {
  name: IconName; size?: number; color?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string
}) {
  const outline = name.endsWith('-outline')
  const base = outline ? name.slice(0, -'-outline'.length) : name
  const def = ICONS[name] ?? ICONS[base]
  if (!def) return <Ionicons name={name} size={size} color={color} style={style} accessibilityLabel={accessibilityLabel} />
  const solid = !outline && def.solid
  const sw = 1.6
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityLabel={accessibilityLabel} pointerEvents="none">
      {def.shapes.map((s, i) => {
        // Gefüllte Variante: erste Form gefüllt, Details darauf in Hintergrundfarbe ausgespart
        const filled = s.fill || (solid && i === 0)
        const detailOnSolid = solid && i > 0 && !s.fill
        const props = {
          fill: filled ? color : 'none',
          stroke: detailOnSolid ? 'rgba(11,16,41,0.9)' : color,
          strokeWidth: filled && !s.fill ? sw : detailOnSolid ? sw * 1.1 : s.fill ? 0 : sw,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        }
        return 'd' in s ? <Path key={i} d={s.d} {...props} /> : <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} {...props} />
      })}
    </Svg>
  )
}

export default Icon

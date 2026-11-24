import { useEffect, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from './Icon'
import type { StoryOverlay } from '../lib/types'
import { MusicSticker } from './music'

export const TEXT_COLORS = ['#ffffff', '#111111', '#e3a585', '#f07d8c', '#8f99e6', '#7cc47f']

/** Inhalt eines Stickers (ohne Positionierung) */
export function OverlayContent({ o, interactive }: { o: StoryOverlay; interactive: boolean }) {
  switch (o.type) {
    case 'text':
      return (
        <Text style={[st.text, { color: o.color }, o.background && { backgroundColor: o.color === '#111111' ? '#fff' : 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, overflow: 'hidden' }, !o.background && st.textShadow]}>
          {o.text}
        </Text>
      )
    case 'music':
      return <MusicSticker track={o.track} onPress={interactive ? undefined : () => {}} />
    case 'location':
      return (
        <Pressable disabled={!interactive} onPress={() => router.push(`/ort/${o.venue_id}`)} style={st.chip} accessibilityLabel={`Ort: ${o.name}`}>
          <Icon name="location" size={16} color="#d6336c" />
          <Text style={st.chipText}>{o.name.toUpperCase()}</Text>
        </Pressable>
      )
    case 'mention':
      return (
        <Pressable disabled={!interactive} onPress={() => router.push(`/profil/${o.profile_id}`)} style={st.chip} accessibilityLabel={`Erwähnt: @${o.handle}`}>
          <Text style={[st.chipText, { color: '#6b4ce6' }]}>@{o.handle.toUpperCase()}</Text>
        </Pressable>
      )
  }
}

/** Sticker an ihrer Position anzeigen (Story ansehen) */
export function StoryOverlayLayer({ overlays, width, height }: { overlays: StoryOverlay[]; width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {overlays.map((o, i) => (
        <Centered key={i} x={o.x * width} y={o.y * height}>
          <OverlayContent o={o} interactive />
        </Centered>
      ))}
    </View>
  )
}

/** Element mit seiner Mitte an (x, y) platzieren */
function Centered({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  return (
    <View
      onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ position: 'absolute', left: x - size.w / 2, top: y - size.h / 2, opacity: size.w ? 1 : 0, maxWidth: '90%' }}
    >
      {children}
    </View>
  )
}

/** Verschiebbarer Sticker im Story-Editor; Ziehen auf den Papierkorb (unten) löscht ihn */
export function DraggableOverlay({ o, width, height, onChange, onRemove, onTap, onDragging }: {
  o: StoryOverlay; width: number; height: number
  onChange: (o: StoryOverlay) => void; onRemove: () => void; onTap?: () => void; onDragging: (d: boolean, overTrash: boolean) => void
}) {
  const start = useRef({ x: 0, y: 0 })
  const [offset, setOffset] = useState({ dx: 0, dy: 0 })
  const latest = useRef({ o, onChange, onRemove, onTap, onDragging, width, height })
  useEffect(() => { latest.current = { o, onChange, onRemove, onTap, onDragging, width, height } })

  // Die Handler lesen die Refs erst während der Geste, nicht beim Rendern
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = { x: latest.current.o.x, y: latest.current.o.y } },
    onPanResponderMove: (_e, g) => {
      setOffset({ dx: g.dx, dy: g.dy })
      const { height: h } = latest.current
      const y = start.current.y + g.dy / h
      if (Math.abs(g.dx) + Math.abs(g.dy) > 6) latest.current.onDragging(true, y > 0.86)
    },
    onPanResponderRelease: (_e, g) => {
      const { o: cur, width: w, height: h } = latest.current
      setOffset({ dx: 0, dy: 0 })
      latest.current.onDragging(false, false)
      if (Math.abs(g.dx) + Math.abs(g.dy) < 6) { latest.current.onTap?.(); return }
      const x = Math.min(0.95, Math.max(0.05, start.current.x + g.dx / w))
      const y = start.current.y + g.dy / h
      if (y > 0.86) latest.current.onRemove()
      else latest.current.onChange({ ...cur, x, y: Math.max(0.05, y) })
    },
  }))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Centered x={o.x * width + offset.dx} y={o.y * height + offset.dy}>
        <View {...pan.panHandlers}>
          <View pointerEvents="none"><OverlayContent o={o} interactive={false} /></View>
        </View>
      </Centered>
    </View>
  )
}

export function TrashZone({ active }: { active: boolean }) {
  return (
    <View style={st.trash} pointerEvents="none">
      <View style={[st.trashCircle, active && { backgroundColor: '#e5484d', transform: [{ scale: 1.15 }] }]}>
        <Icon name="trash-outline" size={26} color="#fff" />
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  text: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  textShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  chipText: { color: '#d6336c', fontWeight: '900', fontSize: 15, letterSpacing: 0.3 },
  trash: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  trashCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
})

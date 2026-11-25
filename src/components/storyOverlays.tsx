import { useEffect, useRef, useState } from 'react'
import { Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { Icon } from './Icon'
import type { StoryOverlay } from '../lib/types'
import { useStoryVotes, useVoteStory } from '../lib/queries'
import { useClock } from './PourDrop'
import { notify } from './report'
import { MusicSticker } from './music'

export const TEXT_COLORS = ['#ffffff', '#111111', '#e3a585', '#f07d8c', '#8f99e6', '#7cc47f']

type Vote = { counts: number[]; mine: number | null }

/** Inhalt eines Stickers (ohne Positionierung) */
export function OverlayContent({ o, interactive, vote, onVote }: { o: StoryOverlay; interactive: boolean; vote?: Vote; onVote?: (option: number) => void }) {
  switch (o.type) {
    case 'poll':
    case 'quiz': {
      const total = vote ? vote.counts.reduce((a, b) => a + b, 0) : 0
      const voted = vote?.mine != null
      return (
        <View style={st.poll}>
          <Text style={st.pollQ}>{o.question}</Text>
          {o.options.map((opt, i) => {
            const pct = total ? Math.round(((vote?.counts[i] ?? 0) / total) * 100) : 0
            const correct = o.type === 'quiz' && voted && i === o.correct
            const wrong = o.type === 'quiz' && voted && vote?.mine === i && i !== o.correct
            return (
              <Pressable key={i} disabled={!interactive || voted} onPress={() => onVote?.(i)} style={[st.pollOpt, correct && { borderColor: '#2f9e5f' }, wrong && { borderColor: '#e5484d' }]} accessibilityLabel={`Antwort: ${opt}`}>
                {voted && <View style={[st.pollBar, { width: `${pct}%` }, correct && { backgroundColor: 'rgba(47,158,95,0.25)' }]} />}
                <Text style={st.pollText}>{opt}</Text>
                {voted && <Text style={st.pollPct}>{pct} %</Text>}
              </Pressable>
            )
          })}
        </View>
      )
    }
    case 'countdown':
      return <CountdownSticker title={o.title} at={o.at} />
    case 'link':
      return (
        <Pressable disabled={!interactive} onPress={() => Linking.openURL(o.url)} style={st.chip} accessibilityLabel={`Link: ${o.label}`}>
          <Icon name="link" size={16} color="#2f6fde" />
          <Text style={[st.chipText, { color: '#2f6fde' }]}>{o.label.toUpperCase()}</Text>
        </Pressable>
      )
    case 'code':
      return (
        <Pressable
          disabled={!interactive}
          onPress={() => Clipboard.setStringAsync(o.code).then(() => notify('Code kopiert', `${o.code} ist in der Zwischenablage.`)).catch(() => notify('Code', o.code))}
          style={st.code}
          accessibilityLabel={`Rabattcode ${o.code} kopieren`}
        >
          <Text style={st.codeLabel}>{o.label.toUpperCase()}</Text>
          <Text style={st.codeText}>{o.code}</Text>
          <Text style={st.codeHint}>Tippen zum Kopieren</Text>
        </Pressable>
      )
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

/** Sticker an ihrer Position anzeigen (Story ansehen); Umfragen und Quiz mit Abstimmung */
export function StoryOverlayLayer({ overlays, width, height, storyId }: { overlays: StoryOverlay[]; width: number; height: number; storyId?: string }) {
  const votes = useStoryVotes(storyId ?? '')
  const vote = useVoteStory(storyId ?? '')
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {overlays.map((o, i) => (
        <Centered key={i} x={o.x * width} y={o.y * height}>
          <OverlayContent o={o} interactive vote={storyId ? votes.data?.[i] ?? { counts: [0, 0, 0, 0], mine: null } : undefined} onVote={option => vote.mutate({ sticker: i, option })} />
        </Centered>
      ))}
    </View>
  )
}

function CountdownSticker({ title, at }: { title: string; at: string }) {
  const t = useClock()
  const [start] = useState(() => Date.now())
  const ms = Math.max(0, new Date(at).getTime() - (start + t * 1000))
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
  return (
    <View style={st.poll}>
      <Text style={st.pollQ}>{title}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
        {[[d, 'Tage'], [h, 'Std.'], [m, 'Min.']].map(([n, l]) => (
          <View key={l} style={st.cdBox}>
            <Text style={st.cdN}>{String(n).padStart(2, '0')}</Text>
            <Text style={st.cdL}>{l}</Text>
          </View>
        ))}
      </View>
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
  poll: { width: 250, backgroundColor: '#fff', borderRadius: 16, padding: 14, gap: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  pollQ: { color: '#111', fontWeight: '800', fontSize: 16, textAlign: 'center', marginBottom: 2 },
  pollOpt: { height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', justifyContent: 'center', paddingHorizontal: 12, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(227,165,133,0.35)' },
  pollText: { color: '#111', fontWeight: '700', flex: 1 },
  pollPct: { color: '#111', fontWeight: '800' },
  cdBox: { alignItems: 'center', backgroundColor: '#141c40', borderRadius: 10, paddingVertical: 6, width: 58 },
  cdN: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cdL: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  code: { alignItems: 'center', backgroundColor: '#141c40', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e3a585' },
  codeLabel: { color: '#eeb999', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  codeText: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  codeHint: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  trash: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  trashCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
})

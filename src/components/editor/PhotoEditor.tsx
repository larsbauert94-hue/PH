// Foto-Editor mit Filtern (wischen oder antippen) und Anpassungen. Nutzt Skia zum Rendern und
// rechnet beim Fertigstellen Filter und Zuschnitt fest ins Bild (JPEG als data:-URI).
import { useMemo, useState } from 'react'
import { ActivityIndicator, Animated, PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Slider from '../Slider'
import { Canvas, ColorMatrix, Image as SkImageView, ImageFormat, Skia, useImage } from '@shopify/react-native-skia'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ADJUST_LABELS, FILTERS, NO_ADJUST, buildMatrix, type Adjustments, type Matrix } from '../../lib/filters'
import { colors } from '../../lib/theme'
import type { LocalFile } from '../../lib/types'
import type { IconName } from '../ui'
import { notify } from '../report'

interface Edit { filter: string; strength: number; adjust: Adjustments }
const DEFAULT_EDIT: Edit = { filter: 'original', strength: 1, adjust: NO_ADJUST }

/** Bild mit Filter in voller Größe berechnen, mittig auf das Seitenverhältnis zugeschnitten */
async function bake(uri: string, matrix: Matrix, aspect: number, maxWidth = 1440): Promise<LocalFile> {
  const data = await Skia.Data.fromURI(uri)
  const img = Skia.Image.MakeImageFromEncoded(data)
  if (!img) throw new Error('Bild konnte nicht gelesen werden.')
  const iw = img.width(), ih = img.height()
  let sw = iw, sh = iw / aspect
  if (sh > ih) { sh = ih; sw = ih * aspect }
  const ow = Math.round(Math.min(maxWidth, sw)), oh = Math.round(ow / aspect)
  const surface = Skia.Surface.MakeOffscreen(ow, oh) ?? Skia.Surface.Make(ow, oh)
  if (!surface) throw new Error('Bild konnte nicht berechnet werden.')
  const paint = Skia.Paint()
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix))
  surface.getCanvas().drawImageRect(img, Skia.XYWHRect((iw - sw) / 2, (ih - sh) / 2, sw, sh), Skia.XYWHRect(0, 0, ow, oh), paint)
  surface.flush()
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 88)
  return { uri: `data:image/jpeg;base64,${base64}`, mime: 'image/jpeg' }
}

export default function PhotoEditor({ files, aspect, onDone, onCancel }: { files: LocalFile[]; aspect: number; onDone: (r: LocalFile[]) => void; onCancel: () => void }) {
  const insets = useSafeAreaInsets()
  const { width: screenW, height: screenH } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const [edits, setEdits] = useState<Edit[]>(() => files.map(() => DEFAULT_EDIT))
  const [tab, setTab] = useState<'filter' | 'adjust'>('filter')
  const [showStrength, setShowStrength] = useState(false)
  const [busy, setBusy] = useState(false)
  const [flash] = useState(() => new Animated.Value(0))
  const [flashName, setFlashName] = useState('')

  const edit = edits[index]
  const image = useImage(files[index].uri)
  const matrix = useMemo(() => buildMatrix(edit.filter, edit.strength, edit.adjust), [edit])

  // Vorschau so groß wie möglich, aber Platz für die Bedienelemente lassen
  const previewW = Math.min(screenW, 560, (screenH - insets.top - insets.bottom - 300) * aspect)
  const previewH = previewW / aspect

  const update = (patch: Partial<Edit>) => setEdits(prev => prev.map((e, i) => i === index ? { ...e, ...patch } : e))

  const showName = (name: string) => {
    setFlashName(name)
    flash.setValue(1)
    Animated.timing(flash, { toValue: 0, duration: 900, delay: 300, useNativeDriver: true }).start()
  }
  const selectFilter = (id: string) => {
    if (id === edit.filter && id !== 'original') { setShowStrength(s => !s); return }
    update({ filter: id, strength: 1 })
    setShowStrength(false)
    showName(FILTERS.find(f => f.id === id)!.name)
  }
  const step = (dir: 1 | -1) => {
    const i = FILTERS.findIndex(f => f.id === edit.filter)
    const next = FILTERS[(i + dir + FILTERS.length) % FILTERS.length]
    update({ filter: next.id, strength: 1 })
    showName(next.name)
  }

  // Wischen über das Bild wechselt den Filter (wie bei Instagram)
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_e, g) => { if (Math.abs(g.dx) > 40) step(g.dx < 0 ? 1 : -1) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [edit.filter, index])

  const done = async () => {
    setBusy(true)
    try {
      const out = await Promise.all(files.map((f, i) => bake(f.uri, buildMatrix(edits[i].filter, edits[i].strength, edits[i].adjust), aspect)))
      onDone(out)
    } catch (e) {
      setBusy(false)
      notify('Fehler', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={st.top}>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityLabel="Abbrechen"><Ionicons name="close" size={28} color={colors.text} /></Pressable>
        <Text style={st.title}>Bearbeiten</Text>
        <Pressable onPress={done} disabled={busy} hitSlop={12} accessibilityLabel="Fertig">
          {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={st.done}>Fertig</Text>}
        </Pressable>
      </View>

      <View style={{ alignItems: 'center' }} {...pan.panHandlers}>
        <View style={{ width: previewW, height: previewH, backgroundColor: '#000' }}>
          {image ? (
            <Canvas style={{ width: previewW, height: previewH }}>
              <SkImageView image={image} x={0} y={0} width={previewW} height={previewH} fit="cover">
                <ColorMatrix matrix={matrix} />
              </SkImageView>
            </Canvas>
          ) : <ActivityIndicator color={colors.accent} style={{ marginTop: previewH / 2 - 10 }} />}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.center, { opacity: flash }]}>
            <Text style={st.flash}>{flashName}</Text>
          </Animated.View>
        </View>
      </View>

      {files.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.pages}>
          {files.map((f, i) => (
            <Pressable key={f.uri + i} onPress={() => { setIndex(i); setShowStrength(false) }} style={[st.page, i === index && st.pageActive]} accessibilityLabel={`Bild ${i + 1} bearbeiten`}>
              <Text style={[st.pageText, i === index && { color: colors.onAccent }]}>{i + 1}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {tab === 'filter' ? (
          showStrength ? (
            <View style={st.sliderBox}>
              <Text style={st.sliderLabel}>{FILTERS.find(f => f.id === edit.filter)?.name} · {Math.round(edit.strength * 100)}</Text>
              <View style={{ width: '100%', flexDirection: 'row' }}><Slider min={0} max={100} value={Math.round(edit.strength * 100)} onChange={v => update({ strength: v / 100 })} accessibilityLabel="Filterstärke" /></View>
              <Pressable onPress={() => setShowStrength(false)}><Text style={st.done}>Fertig</Text></Pressable>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.strip}>
              {FILTERS.map(f => (
                <Pressable key={f.id} onPress={() => selectFilter(f.id)} style={st.filterItem} accessibilityLabel={`Filter ${f.name}`} accessibilityState={{ selected: edit.filter === f.id }}>
                  <Text style={[st.filterName, edit.filter === f.id && { color: colors.text, fontWeight: '700' }]}>{f.name}</Text>
                  <View style={[st.thumb, edit.filter === f.id && st.thumbActive]}>
                    {image && (
                      <Canvas style={{ width: 72, height: 72 }}>
                        <SkImageView image={image} x={0} y={0} width={72} height={72} fit="cover">
                          <ColorMatrix matrix={f.matrix} />
                        </SkImageView>
                      </Canvas>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )
        ) : (
          <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 4 }}>
            {ADJUST_LABELS.map(a => (
              <View key={a.key} style={st.adjustRow}>
                <Ionicons name={a.icon as IconName} size={18} color={colors.muted} />
                <Text style={st.adjustLabel}>{a.label}</Text>
                <Slider min={a.min} max={100} value={edit.adjust[a.key]} onChange={v => update({ adjust: { ...edit.adjust, [a.key]: v } })} accessibilityLabel={a.label} />
                <Text style={st.adjustValue}>{Math.round(edit.adjust[a.key])}</Text>
              </View>
            ))}
            <Pressable onPress={() => update({ adjust: NO_ADJUST })} style={{ alignSelf: 'center', padding: 8 }}><Text style={{ color: colors.muted }}>Zurücksetzen</Text></Pressable>
          </ScrollView>
        )}

        <View style={st.tabs}>
          {([['filter', 'Filter'], ['adjust', 'Bearbeiten']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => { setTab(k); setShowStrength(false) }} style={st.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
              <Text style={[st.tabText, tab === k && { color: colors.text }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 52 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  done: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center' },
  flash: { color: '#fff', fontSize: 30, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 },
  pages: { gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  page: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  pageActive: { backgroundColor: colors.accent },
  pageText: { color: colors.text, fontWeight: '700' },
  strip: { gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  filterItem: { alignItems: 'center', gap: 6 },
  filterName: { color: colors.muted, fontSize: 12 },
  thumb: { width: 72, height: 72, borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface2 },
  thumbActive: { borderColor: colors.text },
  sliderBox: { paddingHorizontal: 24, alignItems: 'center', gap: 6, paddingBottom: 12 },
  sliderLabel: { color: colors.text, fontWeight: '600' },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  adjustLabel: { color: colors.text, width: 86, fontSize: 14 },
  adjustValue: { color: colors.muted, width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabText: { color: colors.faint, fontSize: 15, fontWeight: '700' },
})

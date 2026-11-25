import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import type { FeedPost, Recipe, Template } from '../lib/types'
import { colors, fonts, radius } from '../lib/theme'
import { Icon } from './Icon'
import { tap } from './motion'

const DROP = 'M12 2.5s-7 7.6-7 12.4a7 7 0 0 0 14 0C19 10.1 12 2.5 12 2.5z'

/** Bewertung in Tropfen (1–5); mit onChange zum Antippen */
export function DropRating({ value, size = 18, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.25 }} accessibilityRole={onChange ? 'adjustable' : undefined} accessibilityLabel={`${value} von 5 Tropfen`}>
      {[1, 2, 3, 4, 5].map(i => {
        const on = i <= Math.round(value)
        const drop = (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path d={DROP} fill={on ? colors.accent : 'none'} stroke={on ? colors.accent : colors.faint} strokeWidth={1.6} strokeLinejoin="round" />
          </Svg>
        )
        return onChange ? (
          <Pressable key={i} onPress={() => { tap('select'); onChange(i) }} hitSlop={6} accessibilityLabel={`${i} Tropfen`}>{drop}</Pressable>
        ) : <View key={i}>{drop}</View>
      })}
    </View>
  )
}

export function AromaChips({ aromas, selected, onToggle }: { aromas: string[]; selected?: string[]; onToggle?: (a: string) => void }) {
  return (
    <View style={st.chips}>
      {aromas.map(a => {
        const on = !onToggle || selected?.includes(a)
        return (
          <Pressable key={a} disabled={!onToggle} onPress={() => { tap('select'); onToggle?.(a) }} style={[st.chip, on && onToggle && st.chipOn]}>
            <Text style={[st.chipText, on && onToggle && { color: colors.onAccent }]}>{a}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Check-in im Beitrag: Tropfen, Produkt, Aromen */
export function CheckinBlock({ post }: { post: FeedPost }) {
  if (post.rating == null) return null
  return (
    <View style={st.checkin}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <DropRating value={post.rating} />
        <Text style={st.ratingText}>{post.rating},0</Text>
      </View>
      {post.product_id && post.product_name && (
        <Pressable onPress={() => router.push(`/produkt/${post.product_id}`)} style={st.product} accessibilityRole="link">
          <Icon name="wine-outline" size={16} color={colors.accent} />
          <Text style={st.productText} numberOfLines={1}>{post.product_name}</Text>
          <Icon name="chevron-forward" size={14} color={colors.faint} />
        </Pressable>
      )}
      {!!post.aromas?.length && <AromaChips aromas={post.aromas} />}
    </View>
  )
}

/** Rezept: Zutaten und Schritte; in der Vorschau gekürzt */
export function RecipeBlock({ recipe, full, post }: { recipe: Recipe; full: boolean; post: FeedPost }) {
  const ingredients = full ? recipe.ingredients : recipe.ingredients.slice(0, 3)
  return (
    <View style={st.recipe}>
      <Text style={st.recipeHead}>ZUTATEN</Text>
      {ingredients.map((i, n) => (
        <View key={n} style={st.ingRow}>
          <Text style={st.ingName}>{i.name}</Text>
          <View style={st.ingDots} />
          <Text style={st.ingAmount}>{i.amount}</Text>
        </View>
      ))}
      {!full && recipe.ingredients.length > 3 && <Text style={st.more}>+ {recipe.ingredients.length - 3} weitere</Text>}
      {full && (
        <>
          <Text style={[st.recipeHead, { marginTop: 10 }]}>SO GEHT’S</Text>
          {recipe.steps.map((s, n) => (
            <View key={n} style={st.step}>
              <View style={st.stepNum}><Text style={st.stepNumText}>{n + 1}</Text></View>
              <Text style={st.stepText}>{s}</Text>
            </View>
          ))}
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {!full && (
          <Pressable style={[st.recipeBtn, st.recipeBtnGhost]} onPress={() => router.push(`/post/${post.id}`)}>
            <Text style={st.recipeBtnGhostText}>Ganzes Rezept</Text>
          </Pressable>
        )}
        <Pressable style={st.recipeBtn} onPress={() => router.push({ pathname: '/neu', params: { remix: post.id, t: String(Date.now()) } })} accessibilityRole="button" accessibilityLabel="Nachmixen">
          <Icon name="repeat" size={16} color={colors.onAccent} />
          <Text style={st.recipeBtnText}>Nachmixen{post.remix_count ? ` · ${post.remix_count}` : ''}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/** Gestaltete Vorlage ohne Foto: Menükarte, Event-Plakat oder Neuheit */
export function TemplateCard({ template, title, body, author }: { template: Template; title: string | null; body: string; author: string }) {
  if (template === 'karte') {
    const lines = body.split(/·|\n/).map(l => l.trim()).filter(Boolean)
    return (
      <View style={[st.tpl, { backgroundColor: '#f4ece1', alignItems: 'center' }]}>
        <Text style={[st.tplKicker, { color: '#8a6a4f' }]}>{author.toUpperCase()}</Text>
        <Text style={[st.tplTitle, { color: '#2a1d14' }]}>{title ?? 'Karte'}</Text>
        <View style={[st.tplRule, { backgroundColor: '#c4a27f' }]} />
        {lines.map((l, i) => <Text key={i} style={st.menuLine}>{l}</Text>)}
      </View>
    )
  }
  if (template === 'plakat') {
    return (
      <LinearGradient colors={['#2b1840', '#141c40']} style={st.tpl}>
        <Text style={[st.tplKicker, { color: colors.lavender }]}>EVENT · {author.toUpperCase()}</Text>
        <Text style={[st.tplTitle, { color: '#fff', fontSize: 30, lineHeight: 36 }]}>{title}</Text>
        <View style={[st.tplRule, { backgroundColor: colors.accent }]} />
        <Text style={st.posterBody}>{body}</Text>
      </LinearGradient>
    )
  }
  return (
    <LinearGradient colors={[colors.roseLight, colors.accent, colors.roseDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.tpl}>
      <Text style={[st.tplKicker, { color: colors.brandNavy }]}>NEU · {author.toUpperCase()}</Text>
      <Text style={[st.tplTitle, { color: colors.brandNavy, fontSize: 30, lineHeight: 36 }]}>{title}</Text>
      <View style={[st.tplRule, { backgroundColor: colors.brandNavy }]} />
      <Text style={[st.posterBody, { color: colors.brandNavy }]}>{body}</Text>
    </LinearGradient>
  )
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(227,165,133,0.12)', borderWidth: 1, borderColor: 'rgba(227,165,133,0.25)' },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.accentLight, fontSize: 12, fontWeight: '600' },
  checkin: { gap: 10, paddingHorizontal: 14, paddingTop: 12 },
  ratingText: { color: colors.text, fontWeight: '700' },
  product: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface2, alignSelf: 'flex-start', maxWidth: '100%' },
  productText: { color: colors.text, fontWeight: '600', flexShrink: 1 },
  recipe: { marginHorizontal: 14, marginTop: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface2, gap: 6 },
  recipeHead: { color: colors.accentLight, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  ingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  ingName: { color: colors.text, fontSize: 14 },
  ingDots: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', borderColor: colors.border, marginBottom: 4 },
  ingAmount: { color: colors.text, fontSize: 14, fontWeight: '600' },
  more: { color: colors.muted, fontSize: 12 },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { color: colors.onAccent, fontSize: 12, fontWeight: '800' },
  stepText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  recipeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.accent },
  recipeBtnText: { color: colors.onAccent, fontWeight: '700' },
  recipeBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  recipeBtnGhostText: { color: colors.text, fontWeight: '600' },
  tpl: { marginHorizontal: 12, marginBottom: 4, padding: 22, borderRadius: radius.lg, gap: 8, minHeight: 200, justifyContent: 'center' },
  tplKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  tplTitle: { fontFamily: fonts.brand, fontSize: 26, lineHeight: 32 },
  tplRule: { width: 48, height: 2, marginVertical: 4 },
  menuLine: { color: '#2a1d14', fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, textAlign: 'center' },
  posterBody: { color: 'rgba(255,255,255,0.88)', fontSize: 15, lineHeight: 22 },
})

import { useId } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useCheckinSummary } from '../lib/queries'
import { badgeProgress, type BadgeDef } from '../lib/badges'
import { colors, radius } from '../lib/theme'
import { Icon } from './Icon'

/** Medaille: Roségold-Ring, der sich mit dem Fortschritt füllt */
export function Medal({ badge, current, earned, size = 64 }: { badge: BadgeDef; current: number; earned: boolean; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const pct = Math.min(1, current / badge.target)
  const gid = `m${badge.id.replace(/[^a-z]/g, '')}${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: earned ? 1 : 0.55 }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.roseLight} />
            <Stop offset="1" stopColor={colors.roseDeep} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={3} fill={earned ? 'rgba(227,165,133,0.12)' : 'none'} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={3} fill="none"
          strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <Icon name={badge.icon} size={size * 0.42} color={earned ? colors.accentLight : colors.faint} />
    </View>
  )
}

/** Abzeichen-Leiste im Profil */
export function BadgeShelf({ userId }: { userId: string }) {
  const summary = useCheckinSummary(userId)
  if (!summary.data) return null
  const all = badgeProgress(summary.data)
  const earned = all.filter(b => b.earned)
  const shown = [...earned, ...all.filter(b => !b.earned).sort((a, b) => b.current / b.target - a.current / a.target)].slice(0, 8)
  return (
    <Pressable onPress={() => router.push(`/abzeichen/${userId}`)} style={st.shelf} accessibilityRole="button" accessibilityLabel={`Abzeichen: ${earned.length} von ${all.length}`}>
      <View style={st.head}>
        <Text style={st.title}>Abzeichen</Text>
        <Text style={st.count}>{earned.length} von {all.length}</Text>
        <Icon name="chevron-forward" size={16} color={colors.faint} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {shown.map(b => (
          <View key={b.id} style={{ alignItems: 'center', width: 72, gap: 4 }}>
            <Medal badge={b} current={b.current} earned={b.earned} size={56} />
            <Text style={[st.label, !b.earned && { color: colors.faint }]} numberOfLines={2}>{b.title}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={st.diary}>{summary.data.count} Check-ins · {summary.data.venues} Orte · {summary.data.products} Flaschen</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  shelf: { padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  count: { color: colors.accentLight, fontSize: 13, fontWeight: '600' },
  label: { color: colors.text, fontSize: 11, textAlign: 'center' },
  diary: { color: colors.muted, fontSize: 12 },
})

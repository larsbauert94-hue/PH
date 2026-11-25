import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useCheckinSummary, useProfile } from '../../lib/queries'
import { badgeProgress, BADGES } from '../../lib/badges'
import { colors, fonts, radius } from '../../lib/theme'
import { Medal } from '../../components/Badges'
import PourDrop, { useClock } from '../../components/PourDrop'
import { Loading } from '../../components/ui'

/** Alle Abzeichen einer Person; mit ?neu=… als Feiermoment nach dem Freischalten */
export default function BadgesScreen() {
  const { id, neu } = useLocalSearchParams<{ id: string; neu?: string }>()
  const summary = useCheckinSummary(id)
  const profile = useProfile(id)
  if (!summary.data) return <Loading />
  const all = badgeProgress(summary.data)
  const fresh = neu ? BADGES.filter(b => neu.split(',').includes(b.id)) : []
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
      {fresh.length > 0 && <Celebration titles={fresh.map(b => b.title)} />}
      <Text style={st.lead}>{profile.data?.name ?? ''} hat {all.filter(b => b.earned).length} von {all.length} Abzeichen gesammelt.</Text>
      <View style={st.grid}>
        {all.map(b => (
          <View key={b.id} style={[st.card, b.earned && st.cardEarned]}>
            <Medal badge={b} current={b.current} earned={b.earned} size={64} />
            <Text style={st.title}>{b.title}</Text>
            <Text style={st.text}>{b.text}</Text>
            <Text style={st.progress}>{b.earned ? 'Freigeschaltet' : `${b.current} / ${b.target}`}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

/** Feiermoment: der Tropfen läuft roségold voll */
function Celebration({ titles }: { titles: string[] }) {
  const t = useClock()
  const level = Math.min(1, t / 1.4)
  return (
    <View style={st.celebrate} accessibilityLiveRegion="polite">
      <PourDrop size={110} level={level} t={t} dropOnly fromTop />
      <Text style={st.celebrateKicker}>NEUES ABZEICHEN</Text>
      <Text style={st.celebrateTitle}>{titles.join(' · ')}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  lead: { color: colors.muted, fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 6, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardEarned: { borderColor: 'rgba(227,165,133,0.5)' },
  title: { color: colors.text, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  text: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  progress: { color: colors.accentLight, fontSize: 12, fontWeight: '700' },
  celebrate: { alignItems: 'center', gap: 8, padding: 22, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(227,165,133,0.5)' },
  celebrateKicker: { color: colors.accentLight, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 6 },
  celebrateTitle: { color: colors.text, fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', textAlign: 'center' },
})

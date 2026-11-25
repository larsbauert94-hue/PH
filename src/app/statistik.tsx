import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMe } from '../lib/auth'
import { useBusinessStats } from '../lib/queries'
import { colors, fonts, radius } from '../lib/theme'
import PostCard from '../components/PostCard'
import { ErrorView, Loading } from '../components/ui'

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Pour Pro: Kennzahlen für Betriebe */
export default function StatsScreen() {
  const { me } = useMe()
  const stats = useBusinessStats(me)
  if (stats.isPending) return <Loading />
  if (stats.isError) return <ErrorView error={stats.error} onRetry={stats.refetch} />
  const s = stats.data
  const max = Math.max(1, ...s.by_weekday)
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
      <Text style={st.kicker}>POUR PRO</Text>
      <Text style={st.h1}>Deine Reichweite</Text>
      <View style={st.grid}>
        <Kpi label="Profilaufrufe 7 Tage" value={s.views_7d} />
        <Kpi label="Profilaufrufe 30 Tage" value={s.views_30d} />
        <Kpi label="Follower" value={s.followers} />
        <Kpi label="Beiträge" value={s.posts} />
        <Kpi label="× angestoßen" value={s.likes} />
        <Kpi label="Kommentare" value={s.comments} />
        <Kpi label="Gespeichert" value={s.saves} />
      </View>

      <View style={st.box}>
        <Text style={st.boxTitle}>Wann du postest</Text>
        <View style={st.chart}>
          {s.by_weekday.map((n, i) => (
            <View key={i} style={st.barCol}>
              <Text style={st.barN}>{n || ''}</Text>
              <View style={[st.bar, { height: 8 + (n / max) * 90, opacity: n ? 1 : 0.3 }]} />
              <Text style={st.barL}>{DAYS[i]}</Text>
            </View>
          ))}
        </View>
        <Text style={st.hint}>Tipp: Beiträge am Donnerstag und Freitag erreichen in der Gastro-Szene oft die meisten Menschen.</Text>
      </View>

      {s.top_post && (
        <View style={{ gap: 10 }}>
          <Text style={st.boxTitle}>Dein stärkster Beitrag</Text>
          <PostCard post={s.top_post} />
        </View>
      )}
      <Text style={st.hint}>Über das „•••“-Menü deiner Beiträge kannst du sie hervorheben. Sie erscheinen dann weiter oben im „Für dich“-Feed.</Text>
    </ScrollView>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={st.kpi}>
      <Text style={st.kpiN}>{value.toLocaleString('de-DE')}</Text>
      <Text style={st.kpiL}>{label}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  content: { padding: 16, gap: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },
  kicker: { color: colors.accentLight, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  h1: { color: colors.text, fontFamily: fonts.serif, fontSize: 28, fontWeight: '700', marginTop: -8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '31%', flexGrow: 1, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  kpiN: { color: colors.text, fontSize: 24, fontWeight: '800' },
  kpiL: { color: colors.muted, fontSize: 12, marginTop: 2 },
  box: { padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 },
  boxTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 130 },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  bar: { width: 18, borderRadius: 6, backgroundColor: colors.accent },
  barN: { color: colors.muted, fontSize: 11 },
  barL: { color: colors.muted, fontSize: 12 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
})

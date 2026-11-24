import { useState } from 'react'
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { Icon } from '../components/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { ACCOUNT_TYPES } from '../lib/labels'
import { colors, fonts, radius } from '../lib/theme'
import type { AccountType } from '../lib/types'
import { Button, Field, IconName } from '../components/ui'
import { FadeIn, PressScale, tap } from '../components/motion'

const BUSINESS: AccountType[] = ['bar', 'restaurant', 'haendler', 'lieferant', 'marke']
const PERSON: AccountType[] = ['gastro', 'privat']
const HINTS: Record<AccountType, string> = {
  bar: 'Cocktailbar, Weinbar, Kneipe',
  restaurant: 'Restaurant, Bistro, Hotel',
  haendler: 'Fachhandel, Online-Shop',
  lieferant: 'Großhandel, Distribution',
  marke: 'Weingut, Brennerei, Brauerei, Marke',
  gastro: 'Bartender, Sommelier, Service, Küche',
  privat: 'Für alle, die gern gut trinken',
}

type Group = 'privat' | 'business'
const GROUPS: Record<Group, { title: string; hint: string; icon: IconName; types: AccountType[] }> = {
  privat: { title: 'Privat', hint: 'Als Person: Gastro-Profi oder Genießer:in', icon: 'person-outline', types: PERSON },
  business: { title: 'Unternehmen', hint: 'Bar, Restaurant, Handel, Lieferant oder Marke', icon: 'storefront-outline', types: BUSINESS },
}
const STEPS = ['Art', 'Typ', 'Profil']

export default function Onboarding() {
  const insets = useSafeAreaInsets()
  const { profile, suggestedName, refreshProfile, signOut } = useAuth()
  const [step, setStep] = useState(0)
  const [group, setGroup] = useState<Group | null>(null)
  const [type, setType] = useState<AccountType | null>(null)
  const [name, setName] = useState(suggestedName || (profile?.name !== profile?.handle ? profile?.name : '') || '')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [headline, setHeadline] = useState('')
  const [workplace, setWorkplace] = useState('')
  const [city, setCity] = useState('')
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress] = useState(() => new Animated.Value(1 / 3))

  const go = (n: number) => {
    setStep(n)
    Animated.spring(progress, { toValue: (n + 1) / 3, useNativeDriver: false, damping: 16, stiffness: 120 }).start()
  }
  const chooseGroup = (g: Group) => {
    tap('select'); setGroup(g)
    if (type && !GROUPS[g].types.includes(type)) setType(null)
    setTimeout(() => go(1), 260)
  }
  const chooseType = (t: AccountType) => { tap('select'); setType(t); setTimeout(() => go(2), 260) }

  const business = type ? ACCOUNT_TYPES[type].business : false
  const handleOk = /^[a-z0-9._]{3,30}$/.test(handle)
  const canSubmit = !!type && name.trim().length > 0 && handleOk && adult && terms

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await api.completeOnboarding({ name: name.trim(), handle, account_type: type!, headline, workplace, city })
      tap('medium')
      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#18214d', colors.bg]} locations={[0, 0.6]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={[st.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          {step > 0 ? (
            <Pressable onPress={() => go(step - 1)} hitSlop={12} style={st.round} accessibilityLabel="Zurück"><Icon name="chevron-back" size={20} color={colors.text} /></Pressable>
          ) : <View style={{ width: 36 }} />}
          <View style={st.track}>
            <Animated.View style={[st.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
              <LinearGradient colors={[colors.roseLight, colors.accentLight, colors.roseDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <Pressable onPress={signOut} hitSlop={12}><Text style={st.cancel}>Abbrechen</Text></Pressable>
        </View>
        <Text style={st.step}>Schritt {step + 1} von 3 · {STEPS[step]}</Text>

        {step === 0 && (
          <View key="s0" style={{ gap: 14 }}>
            <FadeIn><Text style={st.h1}>Wer bist du?</Text></FadeIn>
            <FadeIn delay={60}><Text style={st.text}>Privatpersonen und Unternehmen bekommen unterschiedliche Profile. Das lässt sich später nicht selbst ändern.</Text></FadeIn>
            {(Object.keys(GROUPS) as Group[]).map((g, i) => {
              const sel = group === g
              return (
                <FadeIn key={g} delay={140 + i * 90}>
                  <PressScale onPress={() => chooseGroup(g)} style={[st.groupCard, sel && st.cardActive]} accessibilityRole="radio" accessibilityState={{ checked: sel }} accessibilityLabel={GROUPS[g].title}>
                    <View style={[st.groupIcon, sel && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      <Icon name={GROUPS[g].icon} size={34} color={sel ? colors.onAccent : colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.groupTitle}>{GROUPS[g].title}</Text>
                      <Text style={st.cardHint}>{GROUPS[g].hint}</Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={sel ? colors.accent : colors.faint} />
                  </PressScale>
                </FadeIn>
              )
            })}
          </View>
        )}

        {step === 1 && group && (
          <View key="s1" style={{ gap: 12 }}>
            <FadeIn><Text style={st.h1}>{group === 'business' ? 'Was für ein Unternehmen?' : 'Was beschreibt dich am besten?'}</Text></FadeIn>
            <View style={st.grid}>
              {GROUPS[group].types.map((t, i) => (
                <FadeIn key={t} delay={60 + i * 60} style={GROUPS[group].types.length > 2 ? st.gridItem : st.gridItemWide}>
                  <TypeCard type={t} selected={type === t} onPress={() => chooseType(t)} />
                </FadeIn>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <FadeIn key="s2" style={{ gap: 16 }}>
            <View style={st.typeLine}>
              {type && <Icon name={`${ACCOUNT_TYPES[type].icon}-outline` as IconName} size={16} color={colors.accent} />}
              <Text style={st.typeLineText}>{type ? ACCOUNT_TYPES[type].label : ''}</Text>
            </View>
            <Text style={st.h1}>{business ? 'Dein Betrieb' : 'Dein Profil'}</Text>
            <Field label={business ? 'Name des Betriebs' : 'Vor- und Nachname'} value={name} onChangeText={setName} placeholder={business ? 'z. B. Bar Nachtschatten' : 'z. B. Lena Brandt'} />
            <Field
              label="Nutzername"
              value={handle}
              onChangeText={t => setHandle(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
              autoCapitalize="none"
              placeholder="z. B. lena.somm"
            />
            {!handleOk && handle.length > 0 && <Text style={st.hint}>3–30 Zeichen: Kleinbuchstaben, Zahlen, Punkt und Unterstrich.</Text>}
            {type === 'gastro' && (
              <>
                <Field label="Position" value={headline} onChangeText={setHeadline} placeholder="z. B. Head Bartender, Sommelière" />
                <Field label="Arbeitsplatz" value={workplace} onChangeText={setWorkplace} placeholder="z. B. Bar Nachtschatten" />
              </>
            )}
            {type === 'privat' && <Field label="Was trinkst du am liebsten? (optional)" value={headline} onChangeText={setHeadline} placeholder="z. B. Riesling und Islay-Whisky" />}
            <Field label="Stadt" value={city} onChangeText={setCity} placeholder="z. B. Berlin" />

            <View style={st.legalBox}>
              <Check checked={adult} onPress={() => { tap('select'); setAdult(!adult) }}>Ich bin mindestens 18 Jahre alt.</Check>
              <Check checked={terms} onPress={() => { tap('select'); setTerms(!terms) }}>
                Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung. Beleidigende oder rechtswidrige Inhalte sind verboten.
              </Check>
              <Link href="/rechtliches" style={st.link}>Nutzungsbedingungen und Datenschutz lesen</Link>
            </View>

            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title="Los geht's" onPress={submit} loading={busy} disabled={!canSubmit} style={{ marginTop: 4 }} />
          </FadeIn>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function TypeCard({ type, selected, onPress }: { type: AccountType; selected: boolean; onPress: () => void }) {
  const t = ACCOUNT_TYPES[type]
  return (
    <PressScale onPress={onPress} style={[st.card, selected && st.cardActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={t.label}>
      <View style={[st.cardIcon, selected && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        <Icon name={`${t.icon}-outline` as IconName} size={24} color={selected ? colors.onAccent : colors.accent} />
      </View>
      <Text style={st.cardTitle}>{t.label}</Text>
      <Text style={st.cardHint}>{HINTS[type]}</Text>
      {selected && <View style={st.tick}><Icon name="checkmark" size={14} color={colors.onAccent} /></View>}
    </PressScale>
  )
}

function Check({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={st.check} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[st.box, checked && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
        {checked && <Icon name="checkmark" size={15} color={colors.onAccent} />}
      </View>
      <Text style={st.checkText}>{children}</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 36 },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  step: { color: colors.faint, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', marginTop: 18, marginBottom: 10 },
  cancel: { color: colors.muted, fontSize: 15 },
  h1: { color: colors.text, fontFamily: fonts.serif, fontSize: 30, fontWeight: '700', lineHeight: 36 },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.faint, fontSize: 12, marginTop: -8 },
  groupCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, minHeight: 116, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  groupIcon: { width: 68, height: 68, borderRadius: 34, borderWidth: 1, borderColor: 'rgba(227,165,133,0.45)', alignItems: 'center', justifyContent: 'center' },
  groupTitle: { color: colors.text, fontSize: 21, fontWeight: '700', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', flexGrow: 1 },
  gridItemWide: { width: '100%' },
  card: { padding: 16, minHeight: 138, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  cardActive: { borderColor: colors.accent, backgroundColor: '#1d2450' },
  cardIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(227,165,133,0.45)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  tick: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(227,165,133,0.12)' },
  typeLineText: { color: colors.accentLight, fontSize: 13, fontWeight: '600' },
  legalBox: { gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkText: { color: colors.text, fontSize: 14, lineHeight: 21, flex: 1 },
  link: { color: colors.accentLight, textDecorationLine: 'underline', marginLeft: 34, marginTop: -4 },
  error: { color: colors.danger, fontSize: 14 },
})

import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { ACCOUNT_TYPES } from '../lib/labels'
import { colors, radius } from '../lib/theme'
import type { AccountType } from '../lib/types'
import { Button, Field, IconName, SectionLabel, Title } from '../components/ui'

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

export default function Onboarding() {
  const insets = useSafeAreaInsets()
  const { profile, suggestedName, refreshProfile, signOut } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
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

  const business = type ? ACCOUNT_TYPES[type].business : false
  const handleOk = /^[a-z0-9._]{3,30}$/.test(handle)
  const canSubmit = !!type && name.trim().length > 0 && handleOk && adult && terms

  const submit = async () => {
    setBusy(true); setError('')
    try {
      await api.completeOnboarding({ name: name.trim(), handle, account_type: type!, headline, workplace, city })
      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <View style={st.top}>
          {step === 2 ? (
            <Pressable onPress={() => setStep(1)} hitSlop={12} accessibilityLabel="Zurück"><Ionicons name="chevron-back" size={28} color={colors.text} /></Pressable>
          ) : <View />}
          <Text style={st.step}>Schritt {step} von 2</Text>
          <Pressable onPress={signOut} hitSlop={12}><Text style={st.cancel}>Abbrechen</Text></Pressable>
        </View>

        {step === 1 ? (
          <View style={{ gap: 14 }}>
            <Title size={30}>Wer bist du?</Title>
            <Text style={st.text}>Betriebe und Personen bekommen unterschiedliche Profile. Du kannst das später nicht selbst ändern.</Text>
            <SectionLabel>Betrieb</SectionLabel>
            {BUSINESS.map(t => <TypeCard key={t} type={t} selected={type === t} onPress={() => setType(t)} />)}
            <SectionLabel>Person</SectionLabel>
            {PERSON.map(t => <TypeCard key={t} type={t} selected={type === t} onPress={() => setType(t)} />)}
            <Button title="Weiter" disabled={!type} onPress={() => setStep(2)} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Title size={30}>{business ? 'Dein Betrieb' : 'Dein Profil'}</Title>
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

            <Check checked={adult} onPress={() => setAdult(!adult)}>Ich bin mindestens 18 Jahre alt.</Check>
            <Check checked={terms} onPress={() => setTerms(!terms)}>
              Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung. Beleidigende oder rechtswidrige Inhalte sind verboten.
            </Check>
            <Link href="/rechtliches" style={st.link}>Nutzungsbedingungen und Datenschutz lesen</Link>

            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title="Los geht's" onPress={submit} loading={busy} disabled={!canSubmit} style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function TypeCard({ type, selected, onPress }: { type: AccountType; selected: boolean; onPress: () => void }) {
  const t = ACCOUNT_TYPES[type]
  return (
    <Pressable onPress={onPress} style={[st.card, selected && st.cardActive]} accessibilityRole="radio" accessibilityState={{ checked: selected }}>
      <View style={[st.cardIcon, selected && { backgroundColor: colors.accent }]}>
        <Ionicons name={t.icon as IconName} size={20} color={selected ? colors.onAccent : colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.cardTitle}>{t.label}</Text>
        <Text style={st.cardHint}>{HINTS[type]}</Text>
      </View>
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.accent : colors.faint} />
    </Pressable>
  )
}

function Check({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={st.check} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.accent : colors.muted} />
      <Text style={st.checkText}>{children}</Text>
    </Pressable>
  )
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, minHeight: 28 },
  step: { color: colors.faint, fontSize: 13 },
  cancel: { color: colors.muted, fontSize: 15 },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.faint, fontSize: 12, marginTop: -8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderColor: colors.accent, backgroundColor: '#1a2045' },
  cardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardHint: { color: colors.muted, fontSize: 13, marginTop: 2 },
  check: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkText: { color: colors.text, fontSize: 14, lineHeight: 21, flex: 1 },
  link: { color: colors.accentLight, textDecorationLine: 'underline', marginLeft: 36, marginTop: -6 },
  error: { color: colors.danger, fontSize: 14 },
})

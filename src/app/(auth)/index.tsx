import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { isDemo } from '../../lib/supabase'
import { colors, fonts, radius } from '../../lib/theme'
import { notify } from '../../components/report'
import type { IconName } from '../../components/ui'

const PILLARS: { icon: IconName; label: string }[] = [
  { icon: 'wine', label: 'Bars & Restaurants' },
  { icon: 'storefront', label: 'Handel & Lieferanten' },
  { icon: 'ribbon', label: 'Marken & Neuheiten' },
  { icon: 'people', label: 'Gastro-Profis' },
]

export default function Welcome() {
  const insets = useSafeAreaInsets()
  const { signInWithApple, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null)
  const [nativeApple, setNativeApple] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setNativeApple).catch(() => {})
  }, [])

  const run = async (which: 'apple' | 'google', fn: () => Promise<void>) => {
    setBusy(which)
    try { await fn() } catch (e) { notify('Anmeldung fehlgeschlagen', e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }

  // Apple-Login nativ auf iOS; im Demo-Modus überall zum Ausprobieren
  const showApple = nativeApple || isDemo

  return (
    <View style={st.root}>
      <LinearGradient colors={['#4a1424', '#1c0f13', colors.bg]} locations={[0, 0.45, 0.85]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(232,173,90,0.22)', 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.5 }} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={st.scroll} bounces={false}>
      <View style={[st.hero, { paddingTop: insets.top + 40 }]}>
        <View style={st.mark}>
          <Ionicons name="wine" size={30} color={colors.amber} />
        </View>
        <Text style={st.logo}>Pour<Text style={{ color: colors.wineLight }}>.</Text></Text>
        <Text style={st.claim}>Das Netzwerk der Wein-, Spirituosen- und Gastroszene.</Text>

        <View style={st.pillars}>
          {PILLARS.map(p => (
            <View key={p.label} style={st.pillar}>
              <Ionicons name={p.icon} size={14} color={colors.amberLight} />
              <Text style={st.pillarText}>{p.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[st.sheet, { paddingBottom: insets.bottom + 20 }]}>
        {isDemo && (
          <View style={st.demo}>
            <Ionicons name="flask" size={14} color={colors.amber} />
            <Text style={st.demoText}>Demo-Modus: Anmeldung ohne echte Konten, Daten sind Beispiele.</Text>
          </View>
        )}

        {showApple && (nativeApple && !isDemo ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.md}
            style={{ height: 52 }}
            onPress={() => run('apple', signInWithApple)}
          />
        ) : (
          <AuthButton icon="logo-apple" label="Weiter mit Apple" light loading={busy === 'apple'} onPress={() => run('apple', signInWithApple)} />
        ))}
        <AuthButton icon="logo-google" label="Weiter mit Google" loading={busy === 'google'} onPress={() => run('google', signInWithGoogle)} />
        <AuthButton icon="mail" label="Weiter mit E-Mail" outline onPress={() => router.push('/email')} />

        <Text style={st.legal}>
          Nur für Personen ab 18 Jahren. Mit der Anmeldung akzeptierst du unsere{' '}
          <Link href="/rechtliches" style={st.legalLink}>Nutzungsbedingungen und Datenschutzerklärung</Link>.
        </Text>
      </View>
      </ScrollView>
    </View>
  )
}

function AuthButton({ icon, label, onPress, light, outline, loading }: {
  icon: IconName; label: string; onPress: () => void; light?: boolean; outline?: boolean; loading?: boolean
}) {
  const fg = light ? '#000' : colors.text
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        st.btn,
        light && { backgroundColor: '#fff' },
        !light && !outline && { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' },
        outline && { borderColor: 'rgba(244,236,228,0.3)' },
        pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          <Ionicons name={icon} size={20} color={fg} style={st.btnIcon} />
          <Text style={[st.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },
  hero: { paddingHorizontal: 28, paddingBottom: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  mark: { width: 60, height: 60, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(232,173,90,0.4)', backgroundColor: 'rgba(232,173,90,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  logo: { fontFamily: fonts.serif, fontSize: 58, fontWeight: '700', color: colors.text, letterSpacing: -1 },
  claim: { color: colors.muted, fontSize: 18, lineHeight: 26, marginTop: 8, maxWidth: 320 },
  pillars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 28 },
  pillar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  pillarText: { color: colors.text, fontSize: 13 },
  sheet: { paddingHorizontal: 24, paddingTop: 24, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm, backgroundColor: 'rgba(232,173,90,0.1)', marginBottom: 4 },
  demoText: { color: colors.amberLight, fontSize: 12, flex: 1 },
  btn: { height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnIcon: { position: 'absolute', left: 18 },
  btnText: { fontSize: 16, fontWeight: '600' },
  legal: { color: colors.faint, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  legalLink: { color: colors.muted, textDecorationLine: 'underline' },
})

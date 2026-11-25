import { useEffect, useState } from 'react'
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as AppleAuthentication from 'expo-apple-authentication'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useAuth } from '../../lib/auth'
import { isDemo } from '../../lib/supabase'
import { colors, fonts, radius } from '../../lib/theme'
import { notify } from '../../components/report'
import { Icon, type IconName } from '../../components/Icon'
import PourDrop, { useClock } from '../../components/PourDrop'
import { native, PressScale, tap } from '../../components/motion'

const LETTERS = ['P', 'O', 'U', 'R']

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3)

export default function Welcome() {
  const insets = useSafeAreaInsets()
  const [size, setSize] = useState({ w: 390, h: 800 })
  const [sheet, setSheet] = useState<null | 'login' | 'register'>(null)
  const t = useClock()

  // Einstieg: Zeichen erscheint, Tropfen läuft halb voll, Buchstaben und Zeilen folgen
  const logoIn = ease(t / 0.9)
  // Lichtschimmer gleitet alle 4,5 Sekunden über das „P“ (erstmals nach dem Einblenden)
  const shine = t < 0.9 ? -1 : ((t - 0.9) % 4.5) / 1.3
  const float = Math.sin(t * 1.1) * 3

  return (
    <View style={st.root} onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Backdrop t={t} w={size.w} h={size.h} />

      <View style={[st.center, { paddingTop: insets.top + 24 }]}>
        <View style={{ opacity: logoIn, transform: [{ scale: 0.7 + logoIn * 0.3 }, { translateY: (1 - logoIn) * 20 + float }] }}>
          <View style={st.markGlow}>
            <PourDrop size={124} level={0} t={t} shine={shine} />
          </View>
        </View>

        <View style={st.word}>
          {LETTERS.map((l, i) => {
            const a = ease((t - 0.55 - i * 0.09) / 0.6)
            return <Text key={l} style={[st.letter, { opacity: a, transform: [{ translateY: (1 - a) * 14 }] }]}>{l}</Text>
          })}
        </View>

        <View style={[st.rule, { width: 40 + ease((t - 0.9) / 0.8) * 80 }]} />
        <Text style={[st.kicker, { opacity: ease((t - 1) / 0.6) }]}>DAS NETZWERK DER GENUSSSZENE</Text>
      </View>

      <View style={[st.cta, { paddingBottom: insets.bottom + 24, opacity: ease((t - 1.3) / 0.7), transform: [{ translateY: (1 - ease((t - 1.3) / 0.7)) * 24 }] }]}>
        <PressScale onPress={() => setSheet('login')} accessibilityRole="button" accessibilityLabel="Anmelden" style={st.primary}>
          <LinearGradient colors={[colors.roseLight, colors.accent, colors.roseDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={st.primaryText}>Anmelden</Text>
        </PressScale>
        <Pressable onPress={() => { tap(); setSheet('register') }} accessibilityRole="button" accessibilityLabel="Konto erstellen" style={st.secondary} hitSlop={8}>
          <Text style={st.secondaryText}>Neu hier? <Text style={{ color: colors.accentLight, fontWeight: '700' }}>Konto erstellen</Text></Text>
        </Pressable>
      </View>

      {sheet && <AuthSheet mode={sheet} onClose={() => setSheet(null)} />}
    </View>
  )
}

/** Hintergrund: langsam treibende Lichter und aufsteigende Perlen wie im Sektglas */
function Backdrop({ t, w, h }: { t: number; w: number; h: number }) {
  const orbs = [
    { x: 0.2 + Math.sin(t * 0.21) * 0.12, y: 0.22 + Math.cos(t * 0.17) * 0.06, r: 0.75, c: '#c4785a', o: 0.35 },
    { x: 0.85 + Math.cos(t * 0.15) * 0.1, y: 0.55 + Math.sin(t * 0.19) * 0.08, r: 0.7, c: '#5560c9', o: 0.32 },
    { x: 0.4 + Math.sin(t * 0.13 + 2) * 0.15, y: 0.95, r: 0.8, c: '#a3304d', o: 0.26 },
  ]
  const pearls = Array.from({ length: 16 }, (_, i) => {
    const speed = 18 + ((i * 37) % 23)
    const y = h + 20 - ((t * speed + i * 97) % (h + 60))
    const x = ((i * 61) % 100) / 100 * w + Math.sin(t * 1.3 + i) * 6
    return { x, y, r: 1 + (i % 3) * 0.7, o: 0.15 + (i % 4) * 0.08 }
  })
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {orbs.map((o, i) => (
          <RadialGradient key={i} id={`orb${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={o.c} stopOpacity={o.o} />
            <Stop offset="1" stopColor={o.c} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {orbs.map((o, i) => <Circle key={i} cx={o.x * w} cy={o.y * h} r={o.r * Math.max(w, h) * 0.6} fill={`url(#orb${i})`} />)}
      {pearls.map((p, i) => <Circle key={`p${i}`} cx={p.x} cy={p.y} r={p.r} fill={colors.roseLight} opacity={p.o} />)}
    </Svg>
  )
}

/** Anmeldefenster: gleitet von unten herein */
function AuthSheet({ mode, onClose }: { mode: 'login' | 'register'; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const { signInWithApple, signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null)
  const [nativeApple, setNativeApple] = useState(false)
  const [v] = useState(() => new Animated.Value(0))

  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: native, damping: 18, stiffness: 160, mass: 0.9 }).start()
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setNativeApple).catch(() => {})
  }, [v])

  const close = () => Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(onClose)
  const run = async (which: 'apple' | 'google', fn: () => Promise<void>) => {
    setBusy(which)
    try { await fn() } catch (e) { notify('Anmeldung fehlgeschlagen', e instanceof Error ? e.message : String(e)) } finally { setBusy(null) }
  }
  // Apple-Login nativ auf iOS; im Demo-Modus überall zum Ausprobieren
  const showApple = nativeApple || isDemo
  const item = (i: number) => ({
    opacity: v.interpolate({ inputRange: [0, 0.5 + i * 0.1, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24 + i * 10, 0] }) }],
  })

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, st.dim, { opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Schließen" />
      </Animated.View>
      <Animated.View style={[st.sheet, { paddingBottom: insets.bottom + 22, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }] }]}>
        <View style={st.handle} />
        <Animated.View style={item(0)}>
          <Text style={st.sheetTitle}>{mode === 'login' ? 'Willkommen zurück' : 'Schön, dass du da bist'}</Text>
          <Text style={st.sheetSub}>{mode === 'login' ? 'Wie möchtest du dich anmelden?' : 'Wähle, womit du dein Konto erstellst.'}</Text>
        </Animated.View>

        <Animated.View style={[{ gap: 10 }, item(1)]}>
          {showApple && (nativeApple && !isDemo ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={mode === 'login' ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={radius.pill}
              style={{ height: 54 }}
              onPress={() => run('apple', signInWithApple)}
            />
          ) : (
            <AuthButton icon="logo-apple" label="Weiter mit Apple" light loading={busy === 'apple'} onPress={() => run('apple', signInWithApple)} />
          ))}
          <AuthButton icon="logo-google" label="Weiter mit Google" loading={busy === 'google'} onPress={() => run('google', signInWithGoogle)} />
          <AuthButton icon="mail-outline" label="Weiter mit E-Mail" outline onPress={() => router.push({ pathname: '/email', params: { mode } })} />
        </Animated.View>

        <Animated.View style={item(2)}>
          {isDemo && (
            <View style={st.demo}>
              <Icon name="sparkles-outline" size={14} color={colors.accent} />
              <Text style={st.demoText}>Demo: E-Mail demo@example.com (Gastro-Profi) oder nachtschatten@example.com (Bar), Passwort beliebig.</Text>
            </View>
          )}
          <Text style={st.legal}>Nur für Personen ab 18 Jahren. Mit der Anmeldung akzeptierst du unsere</Text>
          <Link href="/rechtliches" style={st.legalLink}>Nutzungsbedingungen und Datenschutzerklärung</Link>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

function AuthButton({ icon, label, onPress, light, outline, loading }: {
  icon: IconName; label: string; onPress: () => void; light?: boolean; outline?: boolean; loading?: boolean
}) {
  const fg = light ? '#0b1029' : colors.text
  return (
    <PressScale
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.97}
      style={[
        st.btn,
        light && { backgroundColor: '#fbf7f3' },
        !light && !outline && { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)' },
        outline && { borderColor: 'rgba(238,185,153,0.45)' },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          <Icon name={icon} size={19} color={fg} style={st.btnIcon} />
          <Text style={[st.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </PressScale>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  markGlow: { borderRadius: 28, shadowColor: '#e3a585', shadowOpacity: 0.45, shadowRadius: 40, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  word: { flexDirection: 'row', marginTop: 34 },
  letter: { fontFamily: fonts.brand, fontSize: 64, color: colors.accentLight, letterSpacing: 10, lineHeight: 74 },
  rule: { height: 1, backgroundColor: 'rgba(238,185,153,0.5)', marginTop: 18, marginBottom: 16 },
  kicker: { color: colors.muted, fontSize: 11, letterSpacing: 3.2, fontWeight: '600' },
  cta: { paddingHorizontal: 24, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' },
  primary: { height: 58, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#e3a585', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  primaryText: { color: colors.onAccent, fontSize: 17, fontWeight: '800', letterSpacing: 0.6 },
  secondary: { alignItems: 'center', paddingVertical: 6 },
  secondaryText: { color: colors.muted, fontSize: 15 },
  dim: { backgroundColor: 'rgba(4,6,18,0.62)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#10173a', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, gap: 18, borderTopWidth: 1, borderColor: 'rgba(238,185,153,0.22)', maxWidth: 560, width: '100%', alignSelf: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(243,237,230,0.25)', alignSelf: 'center', marginBottom: 6 },
  sheetTitle: { color: colors.text, fontFamily: fonts.serif, fontSize: 26, fontWeight: '700', textAlign: 'center' },
  sheetSub: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 6 },
  btn: { height: 54, borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnIcon: { position: 'absolute', left: 22 },
  btnText: { fontSize: 16, fontWeight: '600' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(227,165,133,0.1)', marginBottom: 12 },
  demoText: { color: colors.accentLight, fontSize: 12, flex: 1 },
  legal: { color: colors.faint, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  legalLink: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', textAlign: 'center', marginTop: 2 },
})

import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Icon } from '../../components/Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { colors, radius } from '../../lib/theme'
import { Button, Field, Title } from '../../components/ui'

export default function EmailAuth() {
  const insets = useSafeAreaInsets()
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const params = useLocalSearchParams<{ mode?: string }>()
  const [mode, setMode] = useState<'login' | 'register'>(params.mode === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmSent, setConfirmSent] = useState(false)

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())
  const canSubmit = validEmail && password.length >= (mode === 'register' ? 8 : 1)

  const submit = async () => {
    setBusy(true); setError('')
    try {
      if (mode === 'login') await signInWithEmail(email, password)
      else if (await signUpWithEmail(email, password)) setConfirmSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[st.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Zurück" style={{ marginBottom: 24 }}>
          <Icon name="chevron-back" size={26} color={colors.text} />
        </Pressable>

        {confirmSent ? (
          <View style={{ gap: 16 }}>
            <Icon name="mail-open-outline" size={48} color={colors.accent} />
            <Title>Fast geschafft</Title>
            <Text style={st.text}>Wir haben dir eine E-Mail an {email.trim()} geschickt. Tippe auf den Link darin, um dein Konto zu bestätigen. Danach kannst du dich hier anmelden.</Text>
            <Button title="Zur Anmeldung" onPress={() => { setConfirmSent(false); setMode('login') }} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Title size={32}>{mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}</Title>
            <Text style={st.text}>{mode === 'login' ? 'Melde dich mit deiner E-Mail-Adresse an.' : 'Danach richtest du dein Profil als Betrieb oder Person ein.'}</Text>

            <View style={st.switch}>
              {(['login', 'register'] as const).map(m => (
                <Pressable key={m} onPress={() => { setMode(m); setError('') }} style={[st.switchItem, mode === m && st.switchActive]}>
                  <Text style={[st.switchText, mode === m && { color: colors.bg }]}>{m === 'login' ? 'Anmelden' : 'Registrieren'}</Text>
                </Pressable>
              ))}
            </View>

            <Field label="E-Mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@beispiel.de" />
            <Field
              label={mode === 'register' ? 'Passwort (mindestens 8 Zeichen)' : 'Passwort'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
              onSubmitEditing={() => canSubmit && submit()}
            />
            {error ? <Text style={st.error}>{error}</Text> : null}
            <Button title={mode === 'login' ? 'Anmelden' : 'Konto erstellen'} onPress={submit} loading={busy} disabled={!canSubmit} style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  content: { paddingHorizontal: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 14 },
  switch: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 4 },
  switchItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  switchActive: { backgroundColor: colors.accent },
  switchText: { color: colors.muted, fontWeight: '600' },
})

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import { useQueryClient } from '@tanstack/react-query'
import { isDemo, supabase } from './supabase'
import { api } from './api'
import { demoAuth } from './demo-api'
import { DEMO_USER_ID, seedProfiles } from './demo-data'
import type { Profile } from './types'

WebBrowser.maybeCompleteAuthSession()

type MyProfile = Profile & { terms_accepted_at: string | null }

interface AuthState {
  ready: boolean
  userId: string | null
  profile: MyProfile | null
  /** Angemeldet, aber Onboarding (Profil, 18+, Nutzungsbedingungen) noch offen */
  needsOnboarding: boolean
  /** Name, den Apple beim ersten Login mitliefert, zum Vorausfüllen des Onboardings */
  suggestedName: string
  signInWithEmail(email: string, password: string): Promise<void>
  /** Gibt true zurück, wenn die E-Mail erst bestätigt werden muss */
  signUpWithEmail(email: string, password: string): Promise<boolean>
  signInWithApple(): Promise<void>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
  refreshProfile(): Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [ready, setReady] = useState(isDemo) // Demo-Modus braucht keine Sitzung
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [suggestedName, setSuggestedName] = useState('')

  const loadProfile = useCallback(async (id: string | null) => {
    setProfile(id ? await api.getMyProfile(id) : null)
  }, [])

  // Sitzung beobachten
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null
      setUserId(id)
      // Außerhalb des Callbacks laden, um Deadlocks im Auth-Client zu vermeiden
      setTimeout(() => { loadProfile(id).finally(() => setReady(true)) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [loadProfile])

  const demoLogin = useCallback(async (id: string) => {
    demoAuth.signIn(id)
    setUserId(id)
    await loadProfile(id)
  }, [loadProfile])

  const value = useMemo<AuthState>(() => ({
    ready,
    userId,
    profile,
    needsOnboarding: !!userId && !!profile && !profile.terms_accepted_at,
    suggestedName,

    async signInWithEmail(email, password) {
      // Demo: Beispiel-Adressen (z. B. nachtschatten@example.com) melden das passende Profil an
      if (isDemo) return demoLogin(seedProfiles.find(p => p.email === email.trim().toLowerCase())?.id ?? DEMO_USER_ID)
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-Mail oder Passwort ist falsch.' : error.message)
    },

    async signUpWithEmail(email, password) {
      if (isDemo) { await demoLogin(demoAuth.createUser(email)); return false }
      const { data, error } = await supabase!.auth.signUp({
        email: email.trim(), password, options: { emailRedirectTo: Linking.createURL('/') },
      })
      if (error) throw new Error(error.message)
      return !data.session
    },

    async signInWithApple() {
      if (isDemo) { await demoLogin(demoAuth.createUser('apple.nutzer@privaterelay.appleid.com')); return }
      const rawNonce = Crypto.randomUUID()
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce)
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        })
        if (!cred.identityToken) throw new Error('Apple hat kein Token geliefert.')
        // Apple liefert den Namen nur beim allerersten Login
        if (cred.fullName) setSuggestedName(AppleAuthentication.formatFullName(cred.fullName).trim())
        const { error } = await supabase!.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: rawNonce })
        if (error) throw new Error(error.message)
      } catch (e) {
        if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return
        throw e
      }
    },

    async signInWithGoogle() {
      if (isDemo) { await demoLogin(demoAuth.createUser('google.nutzer@gmail.com')); return }
      const redirectTo = Linking.createURL('auth-callback')
      const { data, error } = await supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      })
      if (error) throw new Error(error.message)
      if (Platform.OS === 'web') return // Browser wird direkt weitergeleitet
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (res.type !== 'success') return
      const { queryParams } = Linking.parse(res.url)
      const code = queryParams?.code
      if (typeof code !== 'string') throw new Error(String(queryParams?.error_description ?? 'Anmeldung abgebrochen.'))
      const flowId = (data as { flowId?: string | null }).flowId
      const ex = await supabase!.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
      if (ex.error) throw new Error(ex.error.message)
    },

    async signOut() {
      if (isDemo) { demoAuth.signOut(); setUserId(null); setProfile(null) }
      else await supabase!.auth.signOut()
      qc.clear()
    },

    async refreshProfile() {
      await loadProfile(userId)
    },
  }), [ready, userId, profile, suggestedName, demoLogin, loadProfile, qc])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth außerhalb von AuthProvider')
  return c
}

/** ID des angemeldeten Nutzers – nur in geschützten Screens verwenden */
export function useMe() {
  const { userId, profile } = useAuth()
  return { me: userId!, profile: profile! }
}

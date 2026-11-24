import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import { BodoniModa_700Bold } from '@expo-google-fonts/bodoni-moda/700Bold'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '../lib/auth'
import { colors, fonts } from '../lib/theme'
import { Button, Loading } from '../components/ui'
import DialogHost from '../components/DialogHost'

// Splash-Screen stehen lassen, bis Schrift und Sitzung geladen sind
SplashScreen.preventAutoHideAsync().catch(() => {})

function Navigation() {
  const { ready, userId, profile, needsOnboarding, refreshProfile, signOut } = useAuth()
  const [fontsLoaded, fontError] = useFonts({ BodoniModa_700Bold })
  const loaded = ready && (fontsLoaded || !!fontError)
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}) }, [loaded])
  if (!loaded) return <Loading />

  if (userId && !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 32, gap: 16 }}>
        <Text style={{ color: colors.text, fontSize: 18, textAlign: 'center' }}>Profil konnte nicht geladen werden.</Text>
        <Button title="Erneut versuchen" onPress={refreshProfile} />
        <Button title="Abmelden" variant="ghost" onPress={signOut} />
      </View>
    )
  }

  const signedIn = !!userId && !needsOnboarding
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.serif, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!userId}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!userId && needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Beitrag' }} />
        <Stack.Screen name="profil/[id]" options={{ title: '' }} />
        <Stack.Screen name="ort/[id]" options={{ title: '' }} />
        <Stack.Screen name="ort/neu" options={{ title: 'Betrieb eintragen', presentation: 'modal' }} />
        <Stack.Screen name="einstellungen" options={{ title: 'Einstellungen' }} />
        <Stack.Screen name="mitteilungen" options={{ title: 'Mitteilungen' }} />
        <Stack.Screen name="nachrichten" options={{ title: 'Nachrichten' }} />
        <Stack.Screen name="editor" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="auswahl/musik" options={{ title: 'Musik hinzufügen', presentation: 'modal' }} />
        <Stack.Screen name="auswahl/ort" options={{ title: 'Ort hinzufügen', presentation: 'modal' }} />
        <Stack.Screen name="auswahl/person" options={{ title: 'Person erwähnen', presentation: 'modal' }} />
        <Stack.Screen name="highlight/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="highlight/neu" options={{ title: 'Neues Highlight', presentation: 'modal' }} />
        <Stack.Screen name="teilen/[id]" options={{ title: 'Senden an', presentation: 'modal' }} />
        <Stack.Screen name="u/[handle]" options={{ title: '' }} />
        <Stack.Screen name="story/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="story/neu" options={{ headerShown: false, presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Screen name="rechtliches" options={{ title: 'Nutzungsbedingungen & Datenschutz', presentation: 'modal' }} />
    </Stack>
  )
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }))
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Navigation />
          <DialogHost />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}

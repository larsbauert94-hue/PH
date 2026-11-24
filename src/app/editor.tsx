import { Suspense, lazy, useEffect, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { router } from 'expo-router'
import { editorSession, finishEditor } from '../lib/editor'
import { colors } from '../lib/theme'
import { Loading } from '../components/ui'

// Skia (Grafik-Engine des Editors) wird erst geladen, wenn der Editor geöffnet wird.
// Im Browser muss vorher CanvasKit (WebAssembly) geladen sein.
const PhotoEditor = lazy(async () => {
  if (Platform.OS === 'web') {
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web')
    await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` })
  }
  return import('../components/editor/PhotoEditor')
})

export default function EditorScreen() {
  const [session] = useState(editorSession)
  // Wird der Editor ohne Ergebnis verlassen (z. B. Zurück-Geste), gilt das als Abbruch
  useEffect(() => () => finishEditor(null), [])

  const close = (result: Parameters<typeof finishEditor>[0]) => {
    finishEditor(result)
    if (router.canGoBack()) router.back()
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.muted }}>Kein Bild zum Bearbeiten.</Text>
      </View>
    )
  }
  return (
    <Suspense fallback={<Loading />}>
      <PhotoEditor files={session.files} aspect={session.aspect} onDone={r => close(r)} onCancel={() => close(null)} />
    </Suspense>
  )
}

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { router } from 'expo-router'
import { editorSession, finishEditor } from '../lib/editor'
import { colors } from '../lib/theme'
import { Loading } from '../components/ui'
import { notify } from '../components/report'
import type { LocalFile } from '../lib/types'

// Skia (Grafik-Engine des Editors) wird erst geladen, wenn der Editor geöffnet wird.
// Im Browser muss vorher CanvasKit (WebAssembly) geladen sein.
const PhotoEditor = lazy(async () => {
  try {
    if (Platform.OS === 'web') {
      const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web')
      // Basis-Pfad wird in der Web-App-Version (Artifact) gesetzt, sonst Wurzel
      const base = (globalThis as { __POUR_BASE__?: string }).__POUR_BASE__ ?? '/'
      await LoadSkiaWeb({ locateFile: (file: string) => `${base}${file}` })
    }
    return await import('../components/editor/PhotoEditor')
  } catch {
    // Ohne Grafik-Engine (z. B. eingeschränkter Browser): Bilder unverändert übernehmen
    return { default: NoEditor }
  }
})

function NoEditor({ files, onDone }: { files: LocalFile[]; aspect: number; onDone: (r: LocalFile[]) => void; onCancel: () => void }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    notify('Filter nicht verfügbar', 'In diesem Browser lassen sich keine Filter anwenden. Das Foto wird unverändert übernommen.')
    onDone(files)
  }, [files, onDone])
  return <Loading />
}

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

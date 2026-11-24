import { router } from 'expo-router'
import type { LocalFile } from './types'

// Übergabe von Bildern an den Foto-Editor (Route /editor) und zurück.
interface Session { files: LocalFile[]; aspect: number; resolve: (r: LocalFile[] | null) => void }
let current: Session | null = null

/**
 * Öffnet den Editor (Filter und Anpassungen) für die Bilder.
 * Liefert die bearbeiteten Bilder oder null bei Abbruch.
 */
export function editPhotos(files: LocalFile[], aspect: number): Promise<LocalFile[] | null> {
  current?.resolve(null)
  return new Promise(resolve => {
    current = { files, aspect, resolve }
    router.push('/editor')
  })
}

export const editorSession = () => current

export function finishEditor(result: LocalFile[] | null) {
  current?.resolve(result)
  current = null
}

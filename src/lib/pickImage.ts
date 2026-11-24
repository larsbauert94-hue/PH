import * as ImagePicker from 'expo-image-picker'
import { notify } from '../components/report'
import type { LocalFile } from './types'

export interface PickedMedia extends LocalFile { type: 'image' | 'video'; duration?: number | null }

/** Foto aus der Mediathek oder (camera=true) mit der Kamera aufnehmen */
export async function pickImage(opts: { camera?: boolean; square?: boolean } = {}) {
  const res = await pickMedia({ camera: opts.camera, aspect: opts.square ? [1, 1] : [4, 3], edit: true })
  return res[0] ?? null
}

/**
 * Allgemeine Auswahl: Bilder und/oder Videos, optional mehrere.
 * Gibt eine leere Liste zurück, wenn abgebrochen wurde.
 */
export async function pickMedia(opts: {
  camera?: boolean
  video?: boolean
  imagesToo?: boolean
  multiple?: boolean
  aspect?: [number, number]
  edit?: boolean
  maxVideoSeconds?: number
} = {}): Promise<PickedMedia[]> {
  if (opts.camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { notify('Kamera', 'Erlaube den Kamerazugriff in den Einstellungen deines Handys.'); return [] }
  }
  const mediaTypes: ImagePicker.MediaType[] = opts.video ? (opts.imagesToo ? ['images', 'videos'] : ['videos']) : ['images']
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes,
    quality: 0.8,
    allowsEditing: !!opts.edit && !opts.multiple,
    aspect: opts.aspect,
    allowsMultipleSelection: !!opts.multiple,
    selectionLimit: opts.multiple ? 10 : 1,
    orderedSelection: true,
    videoMaxDuration: opts.maxVideoSeconds ?? 60,
  }
  const res = opts.camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (res.canceled) return []
  return res.assets.map(a => ({
    uri: a.uri,
    type: a.type === 'video' ? 'video' : 'image',
    mime: a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
    duration: a.duration,
  }))
}

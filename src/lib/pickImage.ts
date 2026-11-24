import * as ImagePicker from 'expo-image-picker'
import { notify } from '../components/report'

/** Foto aus der Mediathek oder (camera=true) mit der Kamera aufnehmen */
export async function pickImage(opts: { camera?: boolean; square?: boolean } = {}) {
  if (opts.camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { notify('Kamera', 'Erlaube den Kamerazugriff in den Einstellungen deines Handys.'); return null }
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: opts.square ? [1, 1] : [4, 3] }
  const res = opts.camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
  if (res.canceled) return null
  return { uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' }
}

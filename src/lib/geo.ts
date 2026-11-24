import { Linking, Platform } from 'react-native'

export interface Coords { latitude: number; longitude: number }

/** Entfernung in km (Haversine) */
export function distanceKm(a: Coords, b: Coords) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLon = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`
}

/** Route in Apple Karten (iOS) bzw. Google Maps öffnen */
export function openRoute(c: Coords, label: string) {
  const q = encodeURIComponent(label)
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?daddr=${c.latitude},${c.longitude}&q=${q}`
    : `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`
  Linking.openURL(url)
}

/** Ausschnitt Deutschland als Startansicht */
export const GERMANY = { latitude: 51.1, longitude: 10.3, latitudeDelta: 8.5, longitudeDelta: 8.5 }

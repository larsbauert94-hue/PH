import { router, type Href } from 'expo-router'
import type { Product, Profile, Track, Venue } from './types'

/**
 * Auswahl-Bildschirm, der ein Ergebnis zurückgibt (z. B. Song, Ort, Person):
 * `const track = await musicPicker.open()`
 */
function createPicker<T>(route: Href) {
  let resolve: ((v: T | null) => void) | null = null
  return {
    open(): Promise<T | null> {
      resolve?.(null)
      return new Promise(r => { resolve = r; router.push(route) })
    },
    finish(value: T | null) {
      resolve?.(value)
      resolve = null
    },
  }
}

export const musicPicker = createPicker<Track>('/auswahl/musik')
export const venuePicker = createPicker<Venue>('/auswahl/ort')
export const personPicker = createPicker<Profile>('/auswahl/person')
export const productPicker = createPicker<Product>('/auswahl/produkt')

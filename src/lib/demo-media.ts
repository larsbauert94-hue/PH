// Beispielbilder und -videos für den Demo-Modus (liegen in assets/demo, erzeugt aus Illustrationen).
import { Asset } from 'expo-asset'

const files = {
  'negroni-post': require('../../assets/demo/negroni-post.jpg'),
  'rotwein-post': require('../../assets/demo/rotwein-post.jpg'),
  'champagner-post': require('../../assets/demo/champagner-post.jpg'),
  'gintonic-post': require('../../assets/demo/gintonic-post.jpg'),
  'whisky-post': require('../../assets/demo/whisky-post.jpg'),
  'weinberg-post': require('../../assets/demo/weinberg-post.jpg'),
  'bar-post': require('../../assets/demo/bar-post.jpg'),
  'keller-post': require('../../assets/demo/keller-post.jpg'),
  'negroni-story': require('../../assets/demo/negroni-story.jpg'),
  'rotwein-story': require('../../assets/demo/rotwein-story.jpg'),
  'champagner-story': require('../../assets/demo/champagner-story.jpg'),
  'gintonic-story': require('../../assets/demo/gintonic-story.jpg'),
  'whisky-story': require('../../assets/demo/whisky-story.jpg'),
  'weinberg-story': require('../../assets/demo/weinberg-story.jpg'),
  'bar-story': require('../../assets/demo/bar-story.jpg'),
  'keller-story': require('../../assets/demo/keller-story.jpg'),
  'negroni-reel': require('../../assets/demo/negroni-reel.mp4'),
  'gintonic-reel': require('../../assets/demo/gintonic-reel.mp4'),
  'bar-reel': require('../../assets/demo/bar-reel.mp4'),
  'negroni-reel-thumb': require('../../assets/demo/negroni-reel-thumb.jpg'),
  'gintonic-reel-thumb': require('../../assets/demo/gintonic-reel-thumb.jpg'),
  'bar-reel-thumb': require('../../assets/demo/bar-reel-thumb.jpg'),
} as const

export type DemoMediaKey = keyof typeof files

export function demoUri(key: string): string {
  const mod = (files as Record<string, number>)[key]
  return mod ? Asset.fromModule(mod).uri : key
}

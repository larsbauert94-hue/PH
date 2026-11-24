import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../lib/theme'
import { Wordmark } from './Logo'
import PourDrop, { useClock } from './PourDrop'

const FILL = 1.7 // Sekunden, bis der Tropfen voll ist
const HOLD = 0.2
const EXIT = 0.6

const clamp = (x: number) => Math.max(0, Math.min(1, x))
// sanft anlaufen und weich auslaufen, damit man das Füllen sieht
const ease = (x: number) => { const v = clamp(x); return v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2 }

/**
 * Ladeübergang in die App: Der Tropfen läuft roségold voll, dann zoomt er
 * auf und gibt den Feed frei.
 */
export default function PourTransition({ onDone, quick = false }: { onDone: () => void; quick?: boolean }) {
  const t = useClock() * (quick ? 1.6 : 1)
  const fill = ease(t / FILL)
  const exit = Math.max(0, Math.min(1, (t - FILL - HOLD) / EXIT))
  const done = t > FILL + HOLD + EXIT

  useEffect(() => { if (done) onDone() }, [done, onDone])

  return (
    <View style={[StyleSheet.absoluteFill, st.root, { opacity: 1 - exit * exit }]} pointerEvents={exit > 0 ? 'none' : 'auto'} accessibilityLabel="Pour wird geladen">
      <View style={{ transform: [{ scale: 1 + Math.pow(exit, 2.2) * 14 }] }}>
        <PourDrop size={190} level={fill} t={t} dropOnly />
      </View>
      <View style={{ opacity: 1 - exit * 3, marginTop: 22 }}>
        <Wordmark size={30} />
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  root: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
})

import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'

/** Native Animationen auf iOS/Android, im Browser per JS */
export const native = Platform.OS !== 'web'

export function tap(style: 'light' | 'medium' | 'select' = 'light') {
  if (Platform.OS === 'web') return
  if (style === 'select') Haptics.selectionAsync().catch(() => {})
  else Haptics.impactAsync(style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

/** Blendet Inhalte weich ein und schiebt sie dabei leicht nach oben */
export function FadeIn({ children, delay = 0, distance = 18, duration = 520, style }: {
  children: ReactNode; delay?: number; distance?: number; duration?: number; style?: StyleProp<ViewStyle>
}) {
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native })
    a.start()
    return () => a.stop()
  }, [v, delay, duration])
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** Endlos laufender Wert 0 → 1 (z. B. für Schimmer, Schweben) */
export function useLoop(duration: number, { reverse = false } = {}) {
  const [v] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const step = Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native })
    const loop = reverse
      ? Animated.loop(Animated.sequence([step, Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: native })]))
      : Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: native }))
    loop.start()
    return () => loop.stop()
  }, [v, duration, reverse])
  return v
}

/** Pressable, das beim Drücken leicht einsinkt */
export function PressScale({ children, style, wrapStyle, scaleTo = 0.96, onPress, haptic = true, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode; style?: StyleProp<ViewStyle>; /** Stil des äußeren Tippbereichs (z. B. flex: 1) */ wrapStyle?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean
}) {
  const [s] = useState(() => new Animated.Value(1))
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: native, speed: 40, bounciness: v === 1 ? 8 : 0 }).start()
  return (
    <Pressable
      {...rest}
      style={wrapStyle}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={e => { if (haptic) tap(); onPress?.(e) }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  )
}

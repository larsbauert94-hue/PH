import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, radius } from '../lib/theme'
import { ACCOUNT_TYPES } from '../lib/labels'
import type { AccountType } from '../lib/types'

export type IconName = ComponentProps<typeof Ionicons>['name']

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

export function Avatar({ name, url, type, size = 40 }: { name: string; url?: string | null; type?: AccountType; size?: number }) {
  const business = type ? ACCOUNT_TYPES[type].business : false
  const r = business ? size * 0.28 : size / 2 // Betriebe eckig, Personen rund
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: r }} />
  const h = hue(name)
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: `hsl(${h}, 45%, 32%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  )
}

export function Verified({ size = 14 }: { size?: number }) {
  return <Ionicons name="checkmark-circle" size={size} color={colors.accent} accessibilityLabel="Verifiziert" />
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
      {icon && <Ionicons name={icon} size={14} color={active ? colors.bg : colors.muted} />}
      <Text style={[s.chipText, active && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  )
}

export function Badge({ label, icon, color = colors.accent }: { label: string; icon?: IconName; color?: string }) {
  return (
    <View style={[s.badge, { borderColor: color + '66', backgroundColor: color + '1a' }]}>
      {icon && <Ionicons name={icon} size={12} color={color} />}
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style }: {
  title: string; onPress?: () => void; variant?: ButtonVariant; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>
}) {
  const bg = { primary: colors.accent, secondary: colors.surface2, ghost: 'transparent', danger: 'transparent' }[variant]
  const fg = variant === 'danger' ? colors.danger : variant === 'primary' ? colors.onAccent : colors.text
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, variant === 'danger' && { borderWidth: 1, borderColor: colors.danger + '66' }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.faint} style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} {...props} />
    </View>
  )
}

export function Title({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return <Text style={{ fontFamily: fonts.serif, fontSize: size, color: colors.text, fontWeight: '700' }}>{children}</Text>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>
}

export function Empty({ icon = 'wine-outline', text }: { icon?: IconName; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
      <Ionicons name={icon} size={40} color={colors.faint} />
      <Text style={{ color: colors.muted, textAlign: 'center' }}>{text}</Text>
    </View>
  )
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.bg }}><ActivityIndicator color={colors.accent} /></View>
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.faint} />
      <Text style={{ color: colors.muted, textAlign: 'center' }}>{error instanceof Error ? error.message : 'Etwas ist schiefgelaufen.'}</Text>
      {onRetry && <Button title="Erneut versuchen" variant="secondary" onPress={onRetry} />}
    </View>
  )
}

export const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  button: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  section: { color: colors.faint, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
})

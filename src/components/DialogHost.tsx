import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { colors, radius } from '../lib/theme'

// Eigene Dialoge für das Web: Browser-Dialoge (alert/confirm/prompt) sind in eingebetteten
// Seiten oft gesperrt. Auf iOS/Android nutzt die App weiterhin die System-Dialoge.

export interface DialogButton { label: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
interface Dialog { title: string; message?: string; buttons: DialogButton[] }

let listener: ((d: Dialog | null) => void) | null = null
const queue: Dialog[] = []

export function showDialog(d: Dialog) {
  queue.push(d)
  if (queue.length === 1) listener?.(d)
}

function next() {
  queue.shift()
  listener?.(queue[0] ?? null)
}

export default function DialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(() => queue[0] ?? null)
  useEffect(() => {
    listener = setDialog
    return () => { listener = null }
  }, [])
  if (!dialog) return null

  const press = (b: DialogButton) => { next(); b.onPress?.() }
  const cancel = dialog.buttons.find(b => b.style === 'cancel')
  const actions = dialog.buttons.filter(b => b.style !== 'cancel')

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => press(cancel ?? { label: '' })}>
      <Pressable style={st.backdrop} onPress={() => cancel && press(cancel)} accessibilityLabel="Schließen">
        <Pressable style={st.sheet} onPress={() => {}} accessibilityRole="alert">
          <Text style={st.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={st.message}>{dialog.message}</Text> : null}
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
            {actions.map(b => (
              <Pressable key={b.label} onPress={() => press(b)} style={({ pressed }) => [st.btn, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                <Text style={[st.btnText, b.style === 'destructive' && { color: colors.danger }]}>{b.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {cancel && (
            <Pressable onPress={() => press(cancel)} style={[st.btn, st.cancel]} accessibilityRole="button">
              <Text style={[st.btnText, { color: colors.muted }]}>{cancel.label}</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,20,0.6)', justifyContent: 'flex-end', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 480, backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  btn: { height: 48, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
})

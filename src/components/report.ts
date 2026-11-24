import { Alert, Platform } from 'react-native'
import { api } from '../lib/api'

const REASONS = ['Spam oder Werbung', 'Beleidigung oder Belästigung', 'Unangemessene Inhalte', 'Falsche Angaben', 'Jugendschutz']

/** Meldedialog für Beiträge und Profile (App-Store-Pflicht bei nutzergenerierten Inhalten) */
export function reportFlow(me: string, target: { postId?: string; profileId?: string }) {
  const send = (reason: string) =>
    api.report(me, target, reason)
      .then(() => notify('Danke für deine Meldung', 'Wir prüfen den Inhalt innerhalb von 24 Stunden.'))
      .catch(e => notify('Fehler', e instanceof Error ? e.message : String(e)))

  if (Platform.OS === 'web') {
    const choice = window.prompt(`Grund der Meldung:\n${REASONS.map((r, i) => `${i + 1}. ${r}`).join('\n')}`, '1')
    const reason = REASONS[Number(choice) - 1]
    if (reason) send(reason)
    return
  }
  Alert.alert('Melden', 'Warum möchtest du das melden?', [
    ...REASONS.map(r => ({ text: r, onPress: () => send(r) })),
    { text: 'Abbrechen', style: 'cancel' as const },
  ])
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert([title, message].filter(Boolean).join('\n\n'))
  else Alert.alert(title, message)
}

/** Bestätigungsdialog, der auch im Web funktioniert */
export function confirmAction(title: string, message: string, confirmText: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: onConfirm },
  ])
}

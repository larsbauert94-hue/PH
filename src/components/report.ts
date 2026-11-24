import { Alert, Platform } from 'react-native'
import { api } from '../lib/api'
import { showDialog, type DialogButton } from './DialogHost'

const REASONS = ['Spam oder Werbung', 'Beleidigung oder Belästigung', 'Unangemessene Inhalte', 'Falsche Angaben', 'Jugendschutz']

/** Dialog mit Buttons: auf iOS/Android der System-Dialog, im Web der eigene (DialogHost) */
function dialog(title: string, message: string | undefined, buttons: DialogButton[]) {
  if (Platform.OS === 'web') { showDialog({ title, message, buttons }); return }
  Alert.alert(title, message, buttons.map(b => ({ text: b.label, style: b.style ?? 'default', onPress: b.onPress })))
}

/** Meldedialog für Beiträge und Profile (App-Store-Pflicht bei nutzergenerierten Inhalten) */
export function reportFlow(me: string, target: { postId?: string; profileId?: string }) {
  const send = (reason: string) =>
    api.report(me, target, reason)
      .then(() => notify('Danke für deine Meldung', 'Wir prüfen den Inhalt innerhalb von 24 Stunden.'))
      .catch(e => notify('Fehler', e instanceof Error ? e.message : String(e)))

  dialog('Melden', 'Warum möchtest du das melden?', [
    ...REASONS.map(r => ({ label: r, onPress: () => send(r) })),
    { label: 'Abbrechen', style: 'cancel' },
  ])
}

export function notify(title: string, message?: string) {
  dialog(title, message, [{ label: 'OK' }])
}

/** Bestätigungsdialog */
export function confirmAction(title: string, message: string, confirmText: string, onConfirm: () => void) {
  dialog(title, message, [
    { label: confirmText, style: 'destructive', onPress: onConfirm },
    { label: 'Abbrechen', style: 'cancel' },
  ])
}

/** Aktionsmenü (z. B. „•••“ bei Beiträgen) */
export function chooseAction(title: string, options: { label: string; destructive?: boolean; onPress: () => void }[]) {
  dialog(title, undefined, [
    ...options.map(o => ({ label: o.label, style: o.destructive ? ('destructive' as const) : ('default' as const), onPress: o.onPress })),
    { label: 'Abbrechen', style: 'cancel' },
  ])
}

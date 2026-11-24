import { ScrollView, StyleSheet, Text } from 'react-native'
import { colors, fonts } from '../lib/theme'

// ENTWURF – vor dem Store-Release von einer Anwältin oder einem Anwalt prüfen lassen
// und Impressum/Kontaktdaten ergänzen.
const SECTIONS: [string, string][] = [
  ['Wer Pour nutzen darf', 'Pour richtet sich an Personen ab 18 Jahren sowie an Betriebe der Wein-, Spirituosen- und Gastronomiebranche. Mit der Registrierung bestätigst du, dass du mindestens 18 Jahre alt bist.'],
  ['Inhalte und Verhalten', 'Es gibt keine Toleranz für beleidigende, diskriminierende, belästigende, sexuelle oder rechtswidrige Inhalte. Inhalte dürfen sich nicht an Minderjährige richten und keinen übermäßigen Alkoholkonsum verherrlichen. Werbung muss als solche erkennbar sein. Verstöße führen zur Löschung der Inhalte und zum Ausschluss.'],
  ['Melden und Blockieren', 'Du kannst jeden Beitrag und jedes Profil melden. Gemeldete Inhalte prüfen wir innerhalb von 24 Stunden und entfernen sie bei Verstößen. Du kannst andere Nutzer jederzeit blockieren.'],
  ['Verantwortung für Angaben', 'Betriebe, Händler, Lieferanten und Marken sind für die Richtigkeit ihrer Angaben, Preise und Angebote selbst verantwortlich. Verifizierte Profile sind mit einem Haken gekennzeichnet.'],
  ['Datenschutz', 'Wir speichern die Daten, die du angibst (Profil, Beiträge, Kommentare, Bilder) sowie deine Anmeldedaten. Deinen Standort nutzen wir nur, während du die Karte verwendest, und speichern ihn nicht. Daten werden bei Supabase in der EU gehostet. Du kannst deinen Account samt aller Daten jederzeit in den Einstellungen löschen.'],
  ['Kontakt', 'Impressum und Kontaktadresse werden vor der Veröffentlichung ergänzt.'],
]

export default function Legal() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={st.content}>
      <Text style={st.draft}>Entwurf – rechtliche Prüfung ausstehend</Text>
      {SECTIONS.map(([h, t]) => (
        <Text key={h} style={st.p}>
          <Text style={st.h}>{h}{'\n'}</Text>
          {t}
        </Text>
      ))}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 680, width: '100%', alignSelf: 'center' },
  draft: { color: colors.amber, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  h: { fontFamily: fonts.serif, fontSize: 18, fontWeight: '700', color: colors.text },
  p: { color: colors.muted, fontSize: 15, lineHeight: 23 },
})

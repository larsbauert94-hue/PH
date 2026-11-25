/** Wöchentlich wechselnde Challenge (Hashtag), automatisch nach Kalenderwoche */
const CHALLENGES = [
  { tag: '#herbstcocktail', title: 'Dein bester Herbst-Cocktail', text: 'Apfel, Birne, Gewürze: zeig uns deinen Drink für kühle Abende.' },
  { tag: '#hausmarke', title: 'Die Hausmarke', text: 'Welche Flasche steht bei euch immer griffbereit hinter dem Tresen?' },
  { tag: '#nullkommanull', title: 'Alkoholfrei, aber richtig gut', text: 'Dein schönster Drink ohne Alkohol.' },
  { tag: '#steillage', title: 'Wein mit Aussicht', text: 'Das Glas Wein mit dem besten Blick.' },
  { tag: '#afterwork', title: 'Feierabend-Drink', text: 'Was trinkst du nach der Schicht?' },
  { tag: '#garnitur', title: 'Die perfekte Garnitur', text: 'Zeste, Kräuter, Eis: das schönste Detail.' },
]

export function currentChallenge(now = new Date()) {
  // ISO-Kalenderwoche
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const week = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7)
  const c = CHALLENGES[week % CHALLENGES.length]
  const daysLeft = 8 - (now.getDay() || 7)
  return { ...c, week, daysLeft }
}

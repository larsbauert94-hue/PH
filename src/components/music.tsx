import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Icon } from './Icon'
import { colors } from '../lib/theme'
import type { Track } from '../lib/types'
import { notify } from './report'

const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11)

/** Song in Spotify öffnen (Abspielen in der App ist laut Spotify nicht erlaubt) */
export function openTrack(t: Track) {
  if (t.spotify_url) Linking.openURL(t.spotify_url)
  else notify(t.title, `${t.artist}\n\nIm Demo-Modus gibt es keinen Spotify-Link. Mit Supabase und Spotify-Zugang öffnet sich hier der Song in Spotify.`)
}

/** Album-Cover oder ein Farbverlauf, wenn kein Cover vorhanden ist */
export function MusicCover({ track, size = 44, radius = 6 }: { track: Track; size?: number; radius?: number }) {
  if (track.cover_url) return <Image source={{ uri: track.cover_url }} style={{ width: size, height: size, borderRadius: radius }} />
  const h = hue(track.title + track.artist)
  return (
    <LinearGradient colors={[`hsl(${h}, 60%, 55%)`, `hsl(${(h + 60) % 360}, 55%, 30%)`]} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="musical-notes" size={size * 0.45} color="rgba(255,255,255,0.9)" />
    </LinearGradient>
  )
}

/** Kleine Zeile „♪ Interpret · Titel“ wie unter dem Namen bei Instagram */
export function MusicLine({ track, light }: { track: Track; light?: boolean }) {
  const color = light ? '#fff' : colors.muted
  return (
    <Pressable onPress={() => openTrack(track)} style={st.line} hitSlop={6} accessibilityLabel={`Musik: ${track.title} von ${track.artist}`}>
      <Icon name="musical-notes" size={12} color={color} />
      <Text style={[st.lineText, { color }, light && st.shadow]} numberOfLines={1}>{track.artist} · {track.title}</Text>
    </Pressable>
  )
}

/** Musik-Sticker für Storys */
export function MusicSticker({ track, onPress }: { track: Track; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? (() => openTrack(track))} style={st.sticker} accessibilityLabel={`Musik: ${track.title} von ${track.artist}`}>
      <MusicCover track={track} size={46} />
      <View style={{ maxWidth: 170 }}>
        <Text style={st.stickerTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={st.stickerArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Icon name="play-circle" size={26} color="#111" />
    </Pressable>
  )
}

const st = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%' },
  lineText: { fontSize: 12, flexShrink: 1 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  sticker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 8, paddingRight: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  stickerTitle: { color: '#111', fontWeight: '800', fontSize: 14 },
  stickerArtist: { color: '#555', fontSize: 12 },
})

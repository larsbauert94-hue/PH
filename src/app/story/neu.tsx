import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMe } from '../../lib/auth'
import { useCreateStory } from '../../lib/queries'
import { pickMedia, type PickedMedia } from '../../lib/pickImage'
import { colors } from '../../lib/theme'
import { Avatar } from '../../components/ui'
import { notify } from '../../components/report'

export default function NewStory() {
  const insets = useSafeAreaInsets()
  const { profile } = useMe()
  const create = useCreateStory()
  const [file, setFile] = useState<PickedMedia | null>(null)
  const [caption, setCaption] = useState('')
  const [editing, setEditing] = useState(false)
  const player = useVideoPlayer(file?.type === 'video' ? file.uri : null, p => { p.loop = true; p.muted = true; p.play() })

  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/') }
  const pick = async (camera: boolean) => {
    const [m] = await pickMedia({ camera, video: true, imagesToo: true, edit: true, aspect: [9, 16], maxVideoSeconds: 30 })
    if (m) setFile(m)
  }
  const share = () => {
    if (!file) return
    create.mutate({ file, media_type: file.type, caption: caption.trim() || undefined }, {
      onSuccess: close,
      onError: e => notify('Story konnte nicht geteilt werden', e.message),
    })
  }

  if (!file) {
    return (
      <View style={[st.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
        <View style={st.topRow}>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Schließen"><Ionicons name="close" size={30} color="#fff" /></Pressable>
          <Text style={st.heading}>Neue Story</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={st.empty}>
          <Ionicons name="sparkles-outline" size={46} color={colors.accent} />
          <Text style={st.emptyTitle}>Teile einen Moment</Text>
          <Text style={st.emptyText}>Storys sind 24 Stunden sichtbar und erscheinen oben im Feed deiner Follower.</Text>
        </View>
        <View style={{ gap: 12, paddingHorizontal: 24 }}>
          {Platform.OS !== 'web' && (
            <Pressable style={[st.bigBtn, { backgroundColor: colors.accent }]} onPress={() => pick(true)}>
              <Ionicons name="camera" size={22} color={colors.onAccent} />
              <Text style={[st.bigBtnText, { color: colors.onAccent }]}>Kamera</Text>
            </Pressable>
          )}
          <Pressable style={[st.bigBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]} onPress={() => pick(false)}>
            <Ionicons name="images" size={22} color="#fff" />
            <Text style={st.bigBtnText}>Foto oder Video auswählen</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {file.type === 'video'
        ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        : <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}

      <View style={[st.topRow, { position: 'absolute', top: insets.top + 12, left: 16, right: 16 }]}>
        <Pressable onPress={() => setFile(null)} hitSlop={10} style={st.round} accessibilityLabel="Zurück"><Ionicons name="chevron-back" size={24} color="#fff" /></Pressable>
        <Pressable onPress={() => setEditing(true)} hitSlop={10} style={st.round} accessibilityLabel="Text hinzufügen"><Text style={st.aa}>Aa</Text></Pressable>
      </View>

      {(editing || caption) ? (
        <View style={st.captionWrap}>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            autoFocus={editing}
            onBlur={() => setEditing(false)}
            placeholder="Text eingeben …"
            placeholderTextColor="rgba(255,255,255,0.7)"
            style={st.captionInput}
            maxLength={200}
            multiline
          />
        </View>
      ) : null}

      <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={st.shareBtn} onPress={share} disabled={create.isPending} accessibilityRole="button">
          <Avatar name={profile.name} url={profile.avatar_url} type={profile.account_type} size={30} />
          <Text style={st.shareText}>{create.isPending ? 'Wird geteilt …' : 'Deine Story'}</Text>
          <Ionicons name="arrow-forward-circle" size={28} color={colors.onAccent} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  heading: { color: '#fff', fontSize: 18, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  bigBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  aa: { color: '#fff', fontSize: 17, fontWeight: '800' },
  captionWrap: { position: 'absolute', left: 24, right: 24, top: '40%', alignItems: 'center' },
  captionInput: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, minWidth: 200 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 30, paddingLeft: 8, paddingRight: 10, paddingVertical: 8 },
  shareText: { color: colors.onAccent, fontSize: 16, fontWeight: '700' },
})

import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMe } from '../lib/auth'
import { useBlock, useFeed, useFollow, useProfile, useProfileStats } from '../lib/queries'
import { ACCOUNT_TYPES, subtitle } from '../lib/labels'
import { colors, fonts, radius } from '../lib/theme'
import PostCard from './PostCard'
import { Avatar, Badge, Button, Empty, ErrorView, IconName, Loading, Verified } from './ui'
import { confirmAction, reportFlow } from './report'

export default function ProfileView({ id, onEdit }: { id: string; onEdit?: () => void }) {
  const { me } = useMe()
  const profile = useProfile(id)
  const stats = useProfileStats(id)
  const posts = useFeed({ authorId: id })
  const follow = useFollow(id)
  const block = useBlock(id)
  const isMe = id === me

  if (profile.isPending) return <Loading />
  if (profile.isError) return <ErrorView error={profile.error} onRetry={profile.refetch} />
  const p = profile.data
  if (!p) return <Empty icon="person-outline" text="Dieses Profil gibt es nicht mehr." />

  const type = ACCOUNT_TYPES[p.account_type]
  const blocked = stats.data?.blocked_by_me

  const more = () => {
    if (blocked) { block.mutate(false); return }
    confirmAction(`${p.name} blockieren?`, 'Ihr seht gegenseitig keine Beiträge und Kommentare mehr und folgt euch nicht mehr.', 'Blockieren', () => block.mutate(true))
  }

  const header = (
    <View style={st.header}>
      <View style={st.top}>
        <Avatar name={p.name} url={p.avatar_url} type={p.account_type} size={84} />
        <View style={st.stats}>
          <Stat n={stats.data?.post_count} label="Beiträge" />
          <Stat n={stats.data?.follower_count} label="Follower" />
          <Stat n={stats.data?.following_count} label="Folgt" />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={st.name}>{p.name}</Text>
          {p.verified && <Verified size={18} />}
        </View>
        <Text style={st.handle}>@{p.handle}</Text>
        <Badge label={type.label} icon={type.icon as IconName} />
        {!type.business && (p.headline || p.workplace) ? <Text style={st.job}>{subtitle(p)}</Text> : null}
        {p.city ? <Text style={st.meta}><Ionicons name="location-outline" size={13} /> {p.city}</Text> : null}
        {p.bio ? <Text style={st.bio}>{p.bio}</Text> : null}
        {p.website ? (
          <Pressable onPress={() => Linking.openURL(p.website!)}>
            <Text style={st.web}><Ionicons name="link" size={13} /> {p.website.replace(/^https?:\/\//, '')}</Text>
          </Pressable>
        ) : null}
      </View>

      {isMe ? (
        onEdit && <Button title="Profil bearbeiten" variant="secondary" icon="create-outline" onPress={onEdit} />
      ) : blocked ? (
        <Button title="Blockierung aufheben" variant="secondary" onPress={more} loading={block.isPending} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title={stats.data?.followed_by_me ? 'Gefolgt' : 'Folgen'}
            icon={stats.data?.followed_by_me ? 'checkmark' : 'add'}
            variant={stats.data?.followed_by_me ? 'secondary' : 'primary'}
            style={{ flex: 1 }}
            loading={follow.isPending}
            onPress={() => follow.mutate(!stats.data?.followed_by_me)}
          />
          <Pressable style={st.iconBtn} onPress={() => reportFlow(me, { profileId: id })} accessibilityLabel="Profil melden">
            <Ionicons name="flag-outline" size={20} color={colors.muted} />
          </Pressable>
          <Pressable style={st.iconBtn} onPress={more} accessibilityLabel="Blockieren">
            <Ionicons name="ban-outline" size={20} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </View>
  )

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={blocked ? [] : posts.data ?? []}
      keyExtractor={x => x.id}
      ListHeaderComponent={header}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 680, width: '100%', alignSelf: 'center' }}
      ListEmptyComponent={posts.isPending ? <Loading /> : <Empty icon="document-text-outline" text={blocked ? 'Du hast dieses Profil blockiert.' : isMe ? 'Du hast noch nichts geteilt.' : 'Noch keine Beiträge.'} />}
    />
  )
}

function Stat({ n, label }: { n?: number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={st.statN}>{n ?? '–'}</Text>
      <Text style={st.statL}>{label}</Text>
    </View>
  )
}

const st = StyleSheet.create({
  header: { gap: 16, marginBottom: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stats: { flex: 1, flexDirection: 'row' },
  statN: { color: colors.text, fontSize: 20, fontWeight: '700' },
  statL: { color: colors.muted, fontSize: 12, marginTop: 2 },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 24, fontWeight: '700', flexShrink: 1 },
  handle: { color: colors.faint, fontSize: 14, marginTop: -4 },
  job: { color: colors.text, fontSize: 15, fontWeight: '500' },
  meta: { color: colors.muted, fontSize: 13 },
  bio: { color: colors.text, fontSize: 15, lineHeight: 21, opacity: 0.9 },
  web: { color: colors.amberLight, fontSize: 14 },
  iconBtn: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
})

import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Icon } from '../../components/Icon'
import { useCreateProduct, useProducts } from '../../lib/queries'
import { productPicker } from '../../lib/picker'
import { CATEGORIES } from '../../lib/labels'
import { colors, radius } from '../../lib/theme'
import type { Category } from '../../lib/types'
import { Button, Chip, Field, Loading } from '../../components/ui'
import { DropRating } from '../../components/checkin'
import { notify } from '../../components/report'

/** Flasche oder Drink auswählen; fehlt etwas, kann man es direkt anlegen */
export default function ProductPicker() {
  const [q, setQ] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<Category>('spirituosen')
  const products = useProducts(q)
  const create = useCreateProduct()
  useEffect(() => () => productPicker.finish(null), [])

  const add = () => create.mutate({ name: q.trim(), brand_name: brand.trim(), category }, {
    onSuccess: id => {
      productPicker.finish({ id, name: q.trim(), brand_name: brand.trim(), brand_id: null, category, description: '', image_url: null, shop_url: null, created_at: new Date().toISOString(), checkin_count: 0, avg_rating: null })
      router.back()
    },
    onError: e => notify('Fehler', e.message),
  })

  return (
    <View style={st.root}>
      <View style={st.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="Gin, Riesling, Whisky …" placeholderTextColor={colors.faint} style={st.input} autoFocus />
      </View>
      {products.isPending ? <Loading /> : (
        <FlatList
          data={products.data ?? []}
          keyExtractor={p => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item: p }) => (
            <Pressable style={st.row} onPress={() => { productPicker.finish(p); router.back() }} accessibilityLabel={p.name}>
              <View style={st.icon}><Icon name="wine-outline" size={20} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{p.name}</Text>
                <Text style={st.sub} numberOfLines={1}>{p.brand_name} · {CATEGORIES[p.category]}</Text>
              </View>
              {p.avg_rating != null && <DropRating value={p.avg_rating} size={12} />}
            </Pressable>
          )}
          ListFooterComponent={q.trim().length >= 2 ? (
            <View style={st.create}>
              <Text style={st.createTitle}>„{q.trim()}“ neu anlegen</Text>
              <Field value={brand} onChangeText={setBrand} placeholder="Marke oder Hersteller (optional)" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(['spirituosen', 'wein', 'bier', 'cocktails', 'alkoholfrei'] as Category[]).map(c => <Chip key={c} label={CATEGORIES[c]} active={category === c} onPress={() => setCategory(c)} />)}
              </View>
              <Button title="Anlegen und auswählen" onPress={add} loading={create.isPending} />
            </View>
          ) : undefined}
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: 12, height: 44 },
  input: { flex: 1, color: colors.text, fontSize: 15, height: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(227,165,133,0.4)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 13 },
  create: { marginTop: 16, padding: 14, gap: 10, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  createTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
})

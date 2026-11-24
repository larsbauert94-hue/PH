import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../lib/theme'
import type { IconName } from '../../components/ui'
import { LogoLockup } from '../../components/Logo'

function icon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color as string} />
  }
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 22 },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', headerTitle: () => <LogoLockup size={30} />, tabBarIcon: icon('newspaper') }} />
      <Tabs.Screen name="karte" options={{ title: 'Karte', headerShown: false, tabBarIcon: icon('map') }} />
      <Tabs.Screen name="neu" options={{ title: 'Posten', headerTitle: 'Neuer Beitrag', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="netzwerk" options={{ title: 'Netzwerk', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  )
}

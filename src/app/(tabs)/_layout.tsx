import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../lib/theme'
import type { IconName } from '../../components/ui'
import { LogoLockup } from '../../components/Logo'
import { HeaderActions, MeButton } from '../../components/HeaderButtons'

function icon(name: IconName, size = 25) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size} color={color as string} />
  }
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 22 },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerLeft: () => <MeButton />,
        headerRight: () => <HeaderActions />,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', headerTitle: () => <LogoLockup size={28} />, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="entdecken" options={{ title: 'Entdecken', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="neu" options={{ title: 'Posten', headerTitle: 'Neu', tabBarIcon: icon('add-circle', 30) }} />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels', headerShown: false, tabBarIcon: icon('film'),
          tabBarStyle: { backgroundColor: '#000', borderTopColor: '#111' },
        }}
      />
      <Tabs.Screen name="karte" options={{ title: 'Karte', headerShown: false, tabBarIcon: icon('map') }} />
    </Tabs>
  )
}

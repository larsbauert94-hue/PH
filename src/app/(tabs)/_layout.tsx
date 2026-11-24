import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts } from '../../lib/theme'
import { useConversations } from '../../lib/queries'
import type { IconName } from '../../components/ui'
import { LogoLockup } from '../../components/Logo'
import { BellButton, MeButton } from '../../components/HeaderButtons'

function icon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color as string} />
  }
}

export default function TabsLayout() {
  const { unread } = useConversations()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.serif, fontWeight: '700', fontSize: 22 },
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerLeft: () => <MeButton />,
        headerRight: () => <BellButton />,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed', headerTitle: () => <LogoLockup size={28} />, tabBarIcon: icon('home') }} />
      <Tabs.Screen name="netzwerk" options={{ title: 'Netzwerk', tabBarIcon: icon('people') }} />
      <Tabs.Screen name="neu" options={{ title: 'Posten', headerTitle: 'Neuer Beitrag', tabBarIcon: icon('add-circle') }} />
      <Tabs.Screen name="karte" options={{ title: 'Karte', headerShown: false, tabBarIcon: icon('map') }} />
      <Tabs.Screen
        name="nachrichten"
        options={{
          title: 'Nachrichten',
          tabBarIcon: icon('chatbubbles'),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.heart, color: '#fff', fontSize: 10 },
        }}
      />
    </Tabs>
  )
}

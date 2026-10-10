import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useI18n } from '@/i18n/i18n';
import { useSharedUploads } from '@/lib/upload/uploads-context';
import { useColors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size} color={color} />
  );

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  // Seen from any tab: how many videos are still being sent.
  const sending = useSharedUploads().items.filter((item) => item.status === 'uploading').length;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerTintColor: c.foreground,
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 22, fontWeight: '600' },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.tabs.yourVideos,
          tabBarIcon: icon('film-outline'),
          tabBarButtonTestID: 'tab-videos',
          tabBarBadge: sending > 0 ? sending : undefined,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t.tabs.events,
          tabBarIcon: icon('albums-outline'),
          tabBarButtonTestID: 'tab-events',
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: t.tabs.shared,
          tabBarIcon: icon('people-outline'),
          tabBarButtonTestID: 'tab-shared',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t.tabs.account,
          tabBarIcon: icon('person-circle-outline'),
          tabBarButtonTestID: 'tab-account',
        }}
      />
    </Tabs>
  );
}

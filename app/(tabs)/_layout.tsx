import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { C } from '../../src/constants/colors';
import { useAppStore } from '../../src/store/useAppStore';

export default function TabLayout() {
  const reviewDue = useAppStore((state) => state.reviewDue);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: C.tabActive,
        tabBarInactiveTintColor: C.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={20}
              color={focused ? C.tabActive : C.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={20}
              color={focused ? C.tabActive : C.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goal',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'bullseye-arrow' : 'bullseye'}
              size={20}
              color={focused ? C.tabActive : C.tabInactive}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarBadge: reviewDue ? '!' : undefined,
          tabBarBadgeStyle: { backgroundColor: C.accent, fontSize: 10, minWidth: 16, height: 16 },
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={20}
              color={focused ? C.tabActive : C.tabInactive}
            />
          ),
        }}
      />
    </Tabs>
  );
}

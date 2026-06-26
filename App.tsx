import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import TodayScreen from './src/screens/TodayScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AddTabScreen from './src/screens/AddTabScreen';
import WeekScreen from './src/screens/WeekScreen';
import TrendsScreen from './src/screens/TrendsScreen';
import AddSessionScreen from './src/screens/AddSessionScreen';
import DayDetailScreen from './src/screens/DayDetailScreen';
import BackfillScreen from './src/screens/BackfillScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import DailyLogScreen from './src/screens/DailyLogScreen';
import StravaSetupScreen from './src/screens/StravaSetupScreen';
import CsvImportScreen from './src/screens/CsvImportScreen';
import JsonImportScreen from './src/screens/JsonImportScreen';
import HealthConnectSetupScreen from './src/screens/HealthConnectSetupScreen';
import WellnessScreen from './src/screens/WellnessScreen';
import ReadinessScreen from './src/screens/ReadinessScreen';
import NutritionScreen from './src/screens/NutritionScreen';
import RecipeBuilderScreen from './src/screens/RecipeBuilderScreen';
import SettingsScreen from './src/screens/SettingsScreen';

import { colors } from './src/theme';
import { AnimatedTabIcon } from './src/components/AnimatedTabIcon';
import { ElevatedAddTab } from './src/components/ElevatedAddTab';
import { ToastHost } from './src/components/ToastHost';
import { RootStackParamList, TabsParamList } from './src/navigation';

const Tabs = createBottomTabNavigator<TabsParamList>();
const Root = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
    notification: colors.primary,
  },
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Today: 'today-outline',
  Calendar: 'calendar-outline',
  AddTab: 'add-circle',
  Week: 'stats-chart-outline',
  Trends: 'trending-up-outline',
};

function TabsNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text, fontWeight: '800' },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 56 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
          // Allow the elevated Add FAB to render outside the bar
          overflow: 'visible',
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 10,
          letterSpacing: 0.3,
          marginTop: 2,
        },
        tabBarIcon: ({ color, size, focused }) => (
          <AnimatedTabIcon
            name={ICON_MAP[route.name]}
            color={color}
            size={size}
            focused={focused}
          />
        ),
      })}
    >
      <Tabs.Screen name="Today" component={TodayScreen} options={{ title: 'Today' }} />
      <Tabs.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tabs.Screen
        name="AddTab"
        component={AddTabScreen}
        options={{
          title: 'Add',
          tabBarLabel: () => null,
          tabBarButton: (props) => <ElevatedAddTab {...props} />,
        }}
      />
      <Tabs.Screen name="Week" component={WeekScreen} options={{ title: 'This Week' }} />
      <Tabs.Screen name="Trends" component={TrendsScreen} options={{ title: 'Trends' }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="light" />
          <Root.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTitleStyle: { color: colors.text, fontWeight: '800' },
              headerTintColor: colors.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Root.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
            <Root.Screen
              name="AddSession"
              component={AddSessionScreen}
              options={{ title: 'Session', presentation: 'modal' }}
            />
            <Root.Screen name="DayDetail" component={DayDetailScreen} options={{ title: 'Day' }} />
            <Root.Screen name="Backfill" component={BackfillScreen} options={{ title: 'Backfill Week' }} />
            <Root.Screen name="Goals" component={GoalsScreen} options={{ title: 'Goals', presentation: 'modal' }} />
            <Root.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings', presentation: 'modal' }} />
            <Root.Screen name="DailyLog" component={DailyLogScreen} options={{ title: 'Daily Log', presentation: 'modal' }} />
            <Root.Screen name="StravaSetup" component={StravaSetupScreen} options={{ title: 'Strava', presentation: 'modal' }} />
            <Root.Screen name="CsvImport" component={CsvImportScreen} options={{ title: 'Import CSV', presentation: 'modal' }} />
            <Root.Screen name="JsonImport" component={JsonImportScreen} options={{ title: 'Restore JSON', presentation: 'modal' }} />
            <Root.Screen name="HealthConnect" component={HealthConnectSetupScreen} options={{ title: 'Health Connect', presentation: 'modal' }} />
            <Root.Screen name="Wellness" component={WellnessScreen} options={{ title: 'Wellness', presentation: 'modal' }} />
            <Root.Screen name="Readiness" component={ReadinessScreen} options={{ title: 'Training Readiness', presentation: 'modal' }} />
            <Root.Screen name="Nutrition" component={NutritionScreen} options={{ title: 'Nutrition', presentation: 'modal' }} />
            <Root.Screen name="RecipeBuilder" component={RecipeBuilderScreen} options={{ title: 'New Recipe', presentation: 'modal' }} />
          </Root.Navigator>
          <ToastHost />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

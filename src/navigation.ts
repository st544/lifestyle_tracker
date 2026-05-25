import { NavigatorScreenParams } from '@react-navigation/native';
import { SessionType } from './types';

export type TabsParamList = {
  Today: undefined;
  Calendar: undefined;
  AddTab: undefined;
  Week: undefined;
  Trends: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  AddSession: {
    type?: SessionType;
    date?: string;          // YYYY-MM-DD prefill
    sessionId?: string;     // edit existing
    startStatus?: 'Planned' | 'Completed';
  } | undefined;
  DayDetail: { date: string };
  Backfill: undefined;
  Goals: undefined;
  DailyLog: { date?: string } | undefined;
  StravaSetup: undefined;
  CsvImport: undefined;
  Wellness: undefined;
  Readiness: undefined;
};

import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { BrainDumpScreen } from './screens/BrainDumpScreen';
import { FocusScreen } from './screens/FocusScreen';
import { GoalScreen } from './screens/GoalScreen';
import { StubScreen } from './screens/StubScreen';
import { TodayScreen } from './screens/TodayScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/focus" element={<FocusScreen />} />
      <Route element={<AppLayout />}>
        <Route index element={<TodayScreen />} />
        <Route path="/goal" element={<GoalScreen />} />
        <Route path="/brain-dump" element={<BrainDumpScreen />} />
        <Route path="/habits" element={<StubScreen title="Habits" />} />
        <Route path="/calendar" element={<StubScreen title="Calendar" />} />
        <Route path="/review" element={<StubScreen title="Review" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

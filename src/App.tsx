import { createRef } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { QuickCreate } from './components/QuickCreate';
import { StatusBanner } from './components/StatusBanner';
import { TaskDialog } from './components/TaskDialog/TaskDialog';
import { todayISO, toDayIndex } from './domain/dates';
import { deleteTask } from './domain/doc';
import { useShortcuts } from './hooks/useShortcuts';
import { usePrefs } from './store/prefsStore';
import { useRoadmap } from './store/roadmapStore';
import { useUi } from './store/uiStore';
import { CalendarView, type CalendarHandle } from './views/calendar/CalendarView';
import { TimelineView, type TimelineHandle } from './views/timeline/TimelineView';
import styles from './App.module.css';

const setPrefs = usePrefs.getState().set;
const roadmap = useRoadmap.getState();
const ui = useUi.getState();
const timeline = createRef<TimelineHandle>();
const calendar = createRef<CalendarHandle>();
const deleteSelected = () => {
  const id = useUi.getState().selectedId;
  if (!id) return;
  roadmap.commit((d) => deleteTask(d, id));
  ui.select(null);
  // the focused bar is gone; don't drop focus to <body> (NF-4). Only one view is mounted.
  timeline.current?.focus();
  calendar.current?.focus();
};
const goToToday = () =>
  usePrefs.getState().view === 'calendar'
    ? setPrefs({ cursor: todayISO() })
    : timeline.current?.scrollToDay(toDayIndex(todayISO()));

const SHORTCUTS: Record<string, () => void> = {
  n: () => ui.openNew(),
  t: goToToday,
  delete: deleteSelected,
  backspace: deleteSelected,
  'mod+z': roadmap.undo,
  'mod+shift+z': roadmap.redo,
  'mod+y': roadmap.redo,
  '1': () => setPrefs({ zoom: 'day' }),
  '2': () => setPrefs({ zoom: 'week' }),
  '3': () => setPrefs({ zoom: 'month' }),
  escape: () => {
    ui.closeQuickCreate();
    ui.select(null);
  },
};

export default function App() {
  const view = usePrefs((s) => s.view);
  useShortcuts(SHORTCUTS);
  return (
    <div className={styles.app}>
      <Toolbar onToday={goToToday} />
      <StatusBanner />
      <main className={styles.body}>
        {view === 'timeline' ? <TimelineView ref={timeline} /> : <CalendarView ref={calendar} />}
      </main>
      <TaskDialog />
      <QuickCreate />
    </div>
  );
}

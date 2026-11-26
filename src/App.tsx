import { createRef } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { QuickCreate } from './components/QuickCreate';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { TaskHoverCard } from './components/TaskHoverCard';
import { StatusBanner } from './components/StatusBanner';
import { TaskDialog } from './components/TaskDialog/TaskDialog';
import { TaskPeek, TodayPanel } from './components/TodayPanel';
import { fromDayIndex, todayISO, toDayIndex } from './domain/dates';
import { deleteTask } from './domain/doc';
import { useShortcuts } from './hooks/useShortcuts';
import { usePrefs } from './store/prefsStore';
import { useRoadmap } from './store/roadmapStore';
import { useUi } from './store/uiStore';
import { CalendarView, type CalendarHandle } from './views/calendar/CalendarView';
import { stepCursor } from './views/calendar/nav';
import { TimelineView, type TimelineHandle } from './views/timeline/TimelineView';
import styles from './App.module.css';

const setPrefs = usePrefs.getState().set;
const roadmap = useRoadmap.getState();
const ui = useUi.getState();
const timeline = createRef<TimelineHandle>();
const calendar = createRef<CalendarHandle>();
// the deleted bar had focus; don't drop it to <body> (NF-4). Only one view is mounted.
const focusView = () => {
  timeline.current?.focus();
  calendar.current?.focus();
};
const deleteSelected = () => {
  const id = useUi.getState().selectedId;
  // only from inside the view: Delete on a toolbar button must not hit an off-screen selection
  if (!id || !document.activeElement?.closest('main')) return;
  roadmap.commit((d) => deleteTask(d, id));
  ui.select(null);
  ui.peek(null);
  focusView();
};
const goToToday = () => {
  const today = todayISO();
  ui.setAgendaDate(today);
  if (usePrefs.getState().view === 'calendar') setPrefs({ cursor: today });
  else timeline.current?.scrollToDay(toDayIndex(today));
};
const step = (dir: 1 | -1) => {
  const { view, calendarMode, cursor } = usePrefs.getState();
  if (view === 'timeline') timeline.current?.step(dir);
  else setPrefs({ cursor: fromDayIndex(stepCursor(calendarMode, toDayIndex(cursor), dir)) });
};
const showShortcuts = () => ui.setShortcutsOpen(true);

const SHORTCUTS: Record<string, () => void> = {
  n: () => ui.openNew(),
  t: goToToday,
  a: () => setPrefs({ agendaOpen: !usePrefs.getState().agendaOpen }),
  delete: deleteSelected,
  backspace: deleteSelected,
  'mod+z': roadmap.undo,
  'mod+shift+z': roadmap.redo,
  'mod+y': roadmap.redo,
  '1': () => setPrefs({ zoom: 'day' }),
  '2': () => setPrefs({ zoom: 'week' }),
  '3': () => setPrefs({ zoom: 'month' }),
  '?': showShortcuts,
  'shift+?': showShortcuts,
  escape: () => {
    ui.closeQuickCreate();
    ui.select(null);
    ui.peek(null);
  },
};

export default function App() {
  const view = usePrefs((s) => s.view);
  const agendaOpen = usePrefs((s) => s.agendaOpen);
  const peekId = useUi((s) => s.peekId);
  useShortcuts(SHORTCUTS);
  return (
    <div className={styles.app}>
      <Toolbar onToday={goToToday} onStep={step} />
      <StatusBanner />
      <div className={styles.row}>
        <main className={styles.body}>
          {view === 'timeline' ? <TimelineView ref={timeline} /> : <CalendarView ref={calendar} />}
        </main>
        {peekId ? <TaskPeek id={peekId} onDeleted={focusView} /> : agendaOpen && <TodayPanel />}
      </div>
      <TaskDialog onDeleted={focusView} />
      <QuickCreate />
      <ShortcutsDialog />
      <TaskHoverCard />
    </div>
  );
}

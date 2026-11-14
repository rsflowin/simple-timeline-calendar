import { Toolbar } from './components/Toolbar/Toolbar';
import { StatusBanner } from './components/StatusBanner';
import { TaskDialog } from './components/TaskDialog/TaskDialog';
import { useShortcuts } from './hooks/useShortcuts';
import { usePrefs } from './store/prefsStore';
import { useRoadmap } from './store/roadmapStore';
import { useUi } from './store/uiStore';
import styles from './App.module.css';

const setPrefs = usePrefs.getState().set;
const roadmap = useRoadmap.getState();
const ui = useUi.getState();

const SHORTCUTS: Record<string, () => void> = {
  n: () => ui.openNew(),
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
      {/* Task 16 makes Today scroll the timeline. */}
      <Toolbar onToday={() => {}} />
      <StatusBanner />
      <main className={styles.body}>
        {view === 'timeline' ? <div>Timeline view</div> : <div>Calendar view</div>}
      </main>
      <TaskDialog />
    </div>
  );
}

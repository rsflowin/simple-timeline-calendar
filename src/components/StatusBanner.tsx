import { todayISO } from '../domain/dates';
import { downloadText } from '../storage/fileTransfer';
import { useStatus } from '../store/statusStore';
import styles from './StatusBanner.module.css';

export function StatusBanner() {
  const message = useStatus((s) => s.message);
  const unreadable = useStatus((s) => s.unreadable);
  const clear = useStatus((s) => s.clear);
  const startSaving = useStatus((s) => s.startSaving);
  if (!message) return null;
  const resume = () => {
    startSaving?.();
    useStatus.setState({ startSaving: null });
  };
  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.message}>{message}</span>
      {unreadable !== null && (
        <button
          type="button"
          onClick={() => {
            downloadText(unreadable, `roadmap-unreadable-${todayISO()}.json`);
            resume();
          }}
        >
          Download backup
        </button>
      )}
      {startSaving ? (
        <button type="button" onClick={resume}>
          Start fresh
        </button>
      ) : (
        // dismissing would drop `unreadable` while it is the only copy
        <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={clear}>
          ×
        </button>
      )}
    </div>
  );
}

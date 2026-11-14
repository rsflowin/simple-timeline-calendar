import { todayISO } from '../domain/dates';
import { downloadText } from '../storage/fileTransfer';
import { useStatus } from '../store/statusStore';
import styles from './StatusBanner.module.css';

export function StatusBanner() {
  const message = useStatus((s) => s.message);
  const unreadable = useStatus((s) => s.unreadable);
  const clear = useStatus((s) => s.clear);
  if (!message) return null;
  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.message}>{message}</span>
      {unreadable !== null && (
        <button
          type="button"
          onClick={() => downloadText(unreadable, `roadmap-unreadable-${todayISO()}.json`)}
        >
          Download backup
        </button>
      )}
      <button type="button" className={styles.dismiss} aria-label="Dismiss" onClick={clear}>
        ×
      </button>
    </div>
  );
}

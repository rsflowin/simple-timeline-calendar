import { useState, type KeyboardEvent } from 'react';
import { formatRange, toDayIndex, type ISODate } from '../domain/dates';
import { addTask } from '../domain/doc';
import { LIMITS } from '../domain/types';
import { useRoadmap } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { Popover } from './Popover';
import styles from './QuickCreate.module.css';

/** Quick-create popover (QC-1 … QC-4), open while `uiStore.quickCreate` is set. Mount once. */
export function QuickCreate() {
  const qc = useUi((s) => s.quickCreate);
  return qc && <QuickCreateForm key={`${qc.start}/${qc.end}`} {...qc} />;
}

function QuickCreateForm({
  start,
  end,
  anchor,
}: {
  start: ISODate;
  end: ISODate;
  anchor: DOMRect;
}) {
  const commit = useRoadmap((s) => s.commit);
  const closeQuickCreate = useUi((s) => s.closeQuickCreate);
  const openNew = useUi((s) => s.openNew);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (title.trim()) {
      try {
        commit((d) => addTask(d, { title, details: '', start, end, tagIds: [] }));
      } catch (err) {
        setError((err as Error).message);
        return;
      }
    }
    closeQuickCreate();
  };

  return (
    <Popover anchor={anchor} label="New task" onClose={closeQuickCreate}>
      <div className={styles.body}>
        <div className={styles.range}>{formatRange(toDayIndex(start), toDayIndex(end))}</div>
        <input
          autoFocus
          aria-label="Task title"
          placeholder="Task title"
          maxLength={LIMITS.title}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
        />
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            closeQuickCreate();
            openNew({ title, start, end });
          }}
        >
          More options
        </button>
      </div>
    </Popover>
  );
}

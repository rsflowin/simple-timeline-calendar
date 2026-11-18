import { formatMonthDay, formatRange, formatWeekday, todayISO, toDayIndex } from '../domain/dates';
import { visibleSpans } from '../domain/spans';
import { usePrefs } from '../store/prefsStore';
import { useDoc } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { openTask } from '../views/openTask';
import { taskColor } from '../views/taskColor';
import { TagChip } from './TagChip';
import styles from './TodayPanel.module.css';

/** Side panel listing every task scheduled today, with details, honouring the tag filter. */
export function TodayPanel() {
  const doc = useDoc();
  const tagFilter = usePrefs((s) => s.tagFilter);
  const setPrefs = usePrefs((s) => s.set);
  // shortcut: read at render, so a tab left open past midnight shows yesterday until something re-renders; add a midnight timer if that matters.
  const today = toDayIndex(todayISO());
  const tagsById = new Map(doc.tags.map((t) => [t.id, t]));
  const filtered = tagFilter.some((id) => tagsById.has(id));
  const spans = visibleSpans(doc, tagFilter)
    .filter((s) => s.start <= today && today <= s.end)
    .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title));

  return (
    <aside className={styles.panel} aria-label="Today's tasks">
      <header className={styles.head}>
        <h2 className={styles.heading}>Today</h2>
        <span className={styles.muted}>
          {formatWeekday(today)}, {formatMonthDay(today)}
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label="Close today's tasks"
          onClick={() => setPrefs({ agendaOpen: false })}
        >
          ×
        </button>
      </header>
      {spans.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>Nothing scheduled today.</p>
          <button type="button" onClick={() => useUi.getState().openNew()}>
            + New task
          </button>
        </div>
      ) : (
        <>
          <p className={styles.muted}>
            {spans.length} task{spans.length === 1 ? '' : 's'}
            {filtered && ' · filtered by tags'}
          </p>
          <ul className={styles.list}>
            {spans.map(({ id, start, end, task }) => (
              <li
                key={id}
                className={styles.item}
                style={{ borderLeftColor: taskColor(task, doc.tags).color }}
              >
                <button type="button" className={styles.title} onClick={() => openTask(id)}>
                  {task.title}
                </button>
                <span className={styles.muted}>
                  {formatRange(start, end)}
                  {end > start && ` · day ${today - start + 1} of ${end - start + 1}`}
                </span>
                {task.tagIds.length > 0 && (
                  <span className={styles.tags}>
                    {task.tagIds.map((tid) => {
                      const tag = tagsById.get(tid);
                      return tag && <TagChip key={tid} tag={tag} />;
                    })}
                  </span>
                )}
                {task.details && <p className={styles.details}>{task.details}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

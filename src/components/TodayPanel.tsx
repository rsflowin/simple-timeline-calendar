import { useEffect } from 'react';
import {
  formatMonthDay,
  formatRange,
  formatWeekday,
  todayISO,
  toDayIndex,
  type DayIndex,
} from '../domain/dates';
import { visibleSpans } from '../domain/spans';
import type { Tag, Task } from '../domain/types';
import { usePrefs } from '../store/prefsStore';
import { useDoc } from '../store/roadmapStore';
import { useUi } from '../store/uiStore';
import { editTask } from '../views/openTask';
import { taskColor } from '../views/taskColor';
import { Icon } from './Icon';
import { TagChip } from './TagChip';
import { TaskForm } from './TaskDialog/TaskDialog';
import styles from './TodayPanel.module.css';

/** `11 days · day 4 of 11`: length, and progress when today is inside the task. */
function progress(start: DayIndex, end: DayIndex, today: DayIndex) {
  const days = end - start + 1;
  if (days === 1) return '';
  return today >= start && today <= end ? `day ${today - start + 1} of ${days}` : `${days} days`;
}

/** One agenda task: title (opens the editor), dates, tags and details. */
function TaskSummary({
  task,
  start,
  end,
  today,
  tags,
}: {
  task: Task;
  start: DayIndex;
  end: DayIndex;
  today: DayIndex;
  tags: readonly Tag[];
}) {
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const p = progress(start, end, today);
  return (
    <div className={styles.item} style={{ borderLeftColor: taskColor(task, tags).color }}>
      <button type="button" className={styles.title} onClick={() => editTask(task.id)}>
        {task.title}
      </button>
      <span className={styles.muted}>
        {formatRange(start, end)}
        {p && ` · ${p}`}
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
    </div>
  );
}

/** Agenda: side panel listing every task scheduled today, with details, honouring the tag filter. */
export function TodayPanel() {
  const doc = useDoc();
  const tagFilter = usePrefs((s) => s.tagFilter);
  const setPrefs = usePrefs((s) => s.set);
  // shortcut: read at render, so a tab left open past midnight shows yesterday until something re-renders; add a midnight timer if that matters.
  const today = toDayIndex(todayISO());
  const filtered = tagFilter.some((id) => doc.tags.some((t) => t.id === id));
  const spans = visibleSpans(doc, tagFilter)
    .filter((s) => s.start <= today && today <= s.end)
    .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title));

  return (
    <aside className={styles.panel} aria-label="Agenda">
      <header className={styles.head}>
        <h2 className={styles.heading}>Today</h2>
        <span className={styles.muted}>
          {formatWeekday(today)}, {formatMonthDay(today)}
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label="Close agenda"
          title="Close (A)"
          onClick={() => setPrefs({ agendaOpen: false })}
        >
          <Icon name="close" />
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
              <li key={id}>
                <TaskSummary task={task} start={start} end={end} today={today} tags={doc.tags} />
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

/** Side peek for the clicked task: edit or delete it right here, without the dialog. Edits are
 * kept when the panel closes or switches task; Cancel discards them. */
export function TaskPeek({ id, onDeleted }: { id: string; onDeleted?(): void }) {
  const doc = useDoc();
  const task = doc.tasks.find((t) => t.id === id);
  const close = () => useUi.getState().peek(null);
  useEffect(() => {
    if (!task) close(); // deleted, or gone on undo
  }, [task]);
  if (!task) return null;
  const { title, details, start, end, tagIds } = task;

  return (
    <aside className={styles.panel} aria-label="Task preview">
      <TaskForm
        key={id}
        id={id}
        initial={{ title, details, start, end, tagIds }}
        inline
        onClose={close}
        onDeleted={onDeleted}
      >
        <header className={styles.head}>
          <h2 className={styles.heading}>Task</h2>
          <button
            type="button"
            className={styles.close}
            aria-label="Close preview"
            title="Close (Esc)"
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </header>
      </TaskForm>
    </aside>
  );
}

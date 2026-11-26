import { useEffect } from 'react';
import {
  formatMonthDay,
  formatRange,
  formatWeekday,
  fromDayIndex,
  isValidISODate,
  parts,
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

/** `11 days · day 4 of 11`: length, and progress when `day` is inside the task. */
function progress(start: DayIndex, end: DayIndex, day: DayIndex) {
  const days = end - start + 1;
  if (days === 1) return '';
  return day >= start && day <= end ? `day ${day - start + 1} of ${days}` : `${days} days`;
}

function formatSubtitle(day: DayIndex, today: DayIndex): string {
  if (day === today) return `${formatWeekday(day)}, ${formatMonthDay(day)}`;
  if (parts(day).year === parts(today).year) return formatWeekday(day);
  return `${formatWeekday(day)}, ${parts(day).year}`;
}

/** One agenda task: title (opens the editor), dates, tags and details. */
function TaskSummary({
  task,
  start,
  end,
  day,
  tags,
}: {
  task: Task;
  start: DayIndex;
  end: DayIndex;
  day: DayIndex;
  tags: readonly Tag[];
}) {
  const tagsById = new Map(tags.map((t) => [t.id, t]));
  const p = progress(start, end, day);
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

/** Agenda: side panel listing every task scheduled on the selected day, with details, honouring the tag filter. */
export function TodayPanel() {
  const doc = useDoc();
  const tagFilter = usePrefs((s) => s.tagFilter);
  const setPrefs = usePrefs((s) => s.set);
  const agendaDate = useUi((s) => s.agendaDate);
  const setAgendaDate = useUi((s) => s.setAgendaDate);
  const today = toDayIndex(todayISO());
  const day = toDayIndex(agendaDate);
  const isToday = day === today;
  const stepDay = (delta: number) => {
    const next = fromDayIndex(day + delta);
    if (isValidISODate(next)) setAgendaDate(next);
  };
  const subtitle = formatSubtitle(day, today);
  const filtered = tagFilter.some((id) => doc.tags.some((t) => t.id === id));
  const spans = visibleSpans(doc, tagFilter)
    .filter((s) => s.start <= day && day <= s.end)
    .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title));

  return (
    <aside className={styles.panel} aria-label="Agenda">
      <header className={styles.head}>
        <h2 className={styles.heading}>{isToday ? 'Today' : formatMonthDay(day)}</h2>
        <span className={styles.muted}>{subtitle}</span>
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
      <div role="group" aria-label="Agenda date navigation" className={styles.nav}>
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Previous day"
          title="Previous day"
          onClick={() => stepDay(-1)}
        >
          <Icon name="chevronLeft" />
        </button>
        <input
          type="date"
          className={styles.dateInput}
          aria-label="Agenda date"
          min="1900-01-01"
          max="2199-12-31"
          value={agendaDate}
          onChange={(e) => {
            if (isValidISODate(e.target.value)) setAgendaDate(e.target.value);
          }}
        />
        <button
          type="button"
          className={styles.navBtn}
          aria-label="Next day"
          title="Next day"
          onClick={() => stepDay(1)}
        >
          <Icon name="chevronRight" />
        </button>
        {!isToday && (
          <button
            type="button"
            className={styles.todayBtn}
            onClick={() => setAgendaDate(todayISO())}
          >
            Today
          </button>
        )}
      </div>
      {spans.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.muted}>
            {isToday ? 'Nothing scheduled today.' : `Nothing scheduled on ${formatMonthDay(day)}.`}
          </p>
          <button
            type="button"
            onClick={() => useUi.getState().openNew({ start: agendaDate, end: agendaDate })}
          >
            + New task
          </button>
        </div>
      ) : (
        <>
          <div className={styles.meta}>
            <p className={styles.muted}>
              {spans.length} task{spans.length === 1 ? '' : 's'}
              {filtered && ' · filtered by tags'}
            </p>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => useUi.getState().openNew({ start: agendaDate, end: agendaDate })}
            >
              + New task
            </button>
          </div>
          <ul className={styles.list}>
            {spans.map(({ id, start, end, task }) => (
              <li key={id}>
                <TaskSummary task={task} start={start} end={end} day={day} tags={doc.tags} />
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

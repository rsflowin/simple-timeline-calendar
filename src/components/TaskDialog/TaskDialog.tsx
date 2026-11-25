import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { formatWeekday, isValidISODate, parseDateInput, toDayIndex } from '../../domain/dates';
import { addTask, deleteTask, updateTask, type TaskInput } from '../../domain/doc';
import { LIMITS, type RoadmapDoc } from '../../domain/types';
import { flushAutosave } from '../../storage/autosave';
import { useDoc, useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { Icon } from '../Icon';
import { TagInput } from '../TagInput/TagInput';
import styles from './TaskDialog.module.css';

/** Task dialog (TD-1 … TD-5), open while `uiStore.editing` is set. Mount once.
 * `onDeleted` runs after Delete, once the dialog is closed, to put focus back (NF-4). */
export function TaskDialog({ onDeleted }: { onDeleted?(): void }) {
  const editing = useUi((s) => s.editing);
  const close = useUi((s) => s.close);
  const doc = useDoc();
  const ref = useRef<HTMLDialogElement>(null);

  const editId = editing?.mode === 'edit' ? editing.id : undefined;
  const task = editId === undefined ? undefined : doc.tasks.find((t) => t.id === editId);
  const initial: TaskInput | undefined =
    editing?.mode === 'new'
      ? editing.draft
      : task && {
          title: task.title,
          details: task.details,
          start: task.start,
          end: task.end,
          tagIds: task.tagIds,
        };
  const isOpen = initial !== undefined;

  useEffect(() => {
    const dialog = ref.current!;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (editing && !isOpen) close(); // edit target no longer exists
  }, [isOpen, editing, close]);

  const label = editId === undefined ? 'New task' : 'Edit task';
  return (
    <dialog ref={ref} className={styles.dialog} aria-label={label} onClose={close}>
      {initial && (
        <TaskForm key={editId ?? 'new'} id={editId} initial={initial} onDeleted={onDeleted}>
          <h2 className={styles.heading}>{label}</h2>
        </TaskForm>
      )}
    </dialog>
  );
}

/** The task fields with Save / Cancel / Delete. The dialog uses it; so does the side peek
 * (`inline`: no autofocus, so a click on a bar doesn't pull focus out of the view). */
export function TaskForm({
  id,
  initial,
  inline,
  children,
  onClose,
  onDeleted,
}: {
  id?: string;
  initial: TaskInput;
  inline?: boolean;
  /** Header, above the fields. */
  children?: ReactNode;
  /** After Save, Cancel or Delete. Defaults to closing the dialog. */
  onClose?(): void;
  onDeleted?(): void;
}) {
  const commit = useRoadmap((s) => s.commit);
  const closeDialog = useUi((s) => s.close);
  const close = onClose ?? closeDialog;
  // only the fields the user changed: the rest follow `initial`, so a drag or undo underneath
  // shows up here and Save never writes those fields back stale
  const [patch, setPatch] = useState<Partial<TaskInput>>({});
  const form = { ...initial, ...patch };
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  const set = (p: Partial<TaskInput>) => {
    setPatch((x) => ({ ...x, ...p }));
    setError(null);
  };
  const endBeforeStart = isValidISODate(form.end) && form.end < form.start;
  const canSave =
    form.title.trim() !== '' &&
    isValidISODate(form.start) &&
    isValidISODate(form.end) &&
    !endBeforeStart;

  // Inline (side peek): leaving the panel — another task, Esc, ✕ — keeps valid edits.
  // Save, Cancel and Delete clear this first.
  const saveOnLeave = useRef<(() => void) | null>(null);
  const changed = JSON.stringify(form) !== JSON.stringify(initial);
  useEffect(() => {
    saveOnLeave.current =
      inline && id !== undefined && changed && canSave
        ? () => commit((d) => (d.tasks.some((t) => t.id === id) ? updateTask(d, id, form) : d))
        : null;
  });
  useEffect(
    () => () => {
      if (!saveOnLeave.current) return;
      saveOnLeave.current();
      flushAutosave();
    },
    [],
  );

  const run = (update: (doc: RoadmapDoc) => RoadmapDoc) => {
    saveOnLeave.current = null;
    try {
      commit(update);
      flushAutosave();
      close();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  };
  // a date field still holding half-typed text marks itself aria-invalid; don't save the stale date
  const save = (el: HTMLFormElement) => {
    if (canSave && !el.querySelector('[aria-invalid="true"]'))
      run((d) => (id === undefined ? addTask(d, form) : updateTask(d, id, form)));
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save(e.currentTarget);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save(e.currentTarget);
    }
  };

  return (
    <form
      className={inline ? `${styles.form} ${styles.inline}` : styles.form}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
    >
      {children}
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input
          autoFocus={!inline}
          maxLength={LIMITS.title}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>
      <div className={styles.dates}>
        <DateField
          label="Start"
          value={form.start}
          onChange={(start) => set(start > form.end ? { start, end: start } : { start })} // TD-3
        />
        <DateField
          label="End"
          value={form.end}
          errorId={endBeforeStart ? `${fieldId}-end` : undefined}
          onChange={(end) => set({ end })}
        />
      </div>
      {endBeforeStart && (
        <p id={`${fieldId}-end`} className={styles.error}>
          End date can&apos;t be before start date
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor={`${fieldId}-tags`} className={styles.label}>
          Tags
        </label>
        <TagInput
          id={`${fieldId}-tags`}
          value={form.tagIds}
          onChange={(tagIds) => set({ tagIds })}
        />
      </div>
      <label className={`${styles.field} ${styles.detailsField}`}>
        <span className={styles.label}>Details</span>
        <textarea
          rows={10}
          maxLength={LIMITS.details}
          value={form.details}
          onChange={(e) => set({ details: e.target.value })}
        />
      </label>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <footer className={styles.footer}>
        {id !== undefined && (
          <button
            type="button"
            className={styles.delete}
            onClick={(e) => {
              const dialog = e.currentTarget.closest('dialog');
              if (!run((d) => deleteTask(d, id))) return;
              useUi.getState().select(null);
              dialog?.close(); // now, not on re-render: a modal dialog won't let focus leave it
              onDeleted?.();
            }}
          >
            Delete
          </button>
        )}
        <span className={styles.spacer} />
        <button
          type="button"
          onClick={() => {
            saveOnLeave.current = null;
            close();
          }}
        >
          Cancel
        </button>
        <button type="submit" className={styles.save} disabled={!canSave} title="Save (Ctrl+Enter)">
          Save
        </button>
      </footer>
    </form>
  );
}

/**
 * A typed date (`2026-11-15`, also `2026/11/15` or `20261115`) with the weekday beside it, plus a
 * calendar button that opens the browser's date picker. Typing commits as soon as the text is a
 * real date; on blur the text snaps back to the committed value.
 */
function DateField({
  label,
  value,
  errorId,
  onChange,
}: {
  label: string;
  value: string;
  errorId?: string;
  onChange(value: string): void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null); // text while typing
  const text = draft ?? value;
  const typedBad = draft !== null && parseDateInput(draft) === null;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <span className={styles.date} data-invalid={errorId || typedBad ? '' : undefined}>
        <input
          id={id}
          value={text}
          placeholder="YYYY-MM-DD"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={errorId !== undefined || typedBad}
          aria-describedby={errorId}
          onChange={(e) => {
            setDraft(e.target.value);
            const iso = parseDateInput(e.target.value);
            if (iso) onChange(iso);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className={styles.weekday} aria-hidden="true">
          {isValidISODate(value) && formatWeekday(toDayIndex(value))}
        </span>
        <span className={styles.pick} title="Choose from calendar">
          <Icon name="calendar" />
          <input
            type="date"
            value={value}
            aria-label={`Choose ${label.toLowerCase()} date from calendar`}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                // not allowed here (e.g. no user activation): the browser's own picker key still works
              }
            }}
            onChange={(e) => {
              setDraft(null);
              if (isValidISODate(e.target.value)) onChange(e.target.value);
            }}
          />
        </span>
      </span>
    </div>
  );
}

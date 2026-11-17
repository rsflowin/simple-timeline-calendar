import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { isValidISODate } from '../../domain/dates';
import { addTask, deleteTask, updateTask, type TaskInput } from '../../domain/doc';
import { LIMITS, type RoadmapDoc } from '../../domain/types';
import { flushAutosave } from '../../storage/autosave';
import { useDoc, useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
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
        <TaskForm
          key={editId ?? 'new'}
          id={editId}
          initial={initial}
          label={label}
          onDeleted={onDeleted}
        />
      )}
    </dialog>
  );
}

function TaskForm({
  id,
  initial,
  label,
  onDeleted,
}: {
  id?: string;
  initial: TaskInput;
  label: string;
  onDeleted?(): void;
}) {
  const commit = useRoadmap((s) => s.commit);
  const close = useUi((s) => s.close);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  const set = (patch: Partial<TaskInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };
  const endBeforeStart = isValidISODate(form.end) && form.end < form.start;
  const canSave =
    form.title.trim() !== '' &&
    isValidISODate(form.start) &&
    isValidISODate(form.end) &&
    !endBeforeStart;

  const run = (update: (doc: RoadmapDoc) => RoadmapDoc) => {
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
  const save = () => {
    if (canSave) run((d) => (id === undefined ? addTask(d, form) : updateTask(d, id, form)));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <h2 className={styles.heading}>{label}</h2>
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input
          autoFocus
          maxLength={LIMITS.title}
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </label>
      <div className={styles.dates}>
        <label className={styles.field}>
          <span className={styles.label}>Start</span>
          <input
            type="date"
            value={form.start}
            onChange={(e) => {
              const start = e.target.value;
              set(start > form.end ? { start, end: start } : { start }); // TD-3
            }}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>End</span>
          <input
            type="date"
            value={form.end}
            aria-invalid={endBeforeStart}
            aria-describedby={endBeforeStart ? `${fieldId}-end` : undefined}
            onChange={(e) => set({ end: e.target.value })}
          />
        </label>
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
              const dialog = e.currentTarget.closest('dialog')!;
              if (!run((d) => deleteTask(d, id))) return;
              useUi.getState().select(null);
              dialog.close(); // now, not on re-render: a modal dialog won't let focus leave it
              onDeleted?.();
            }}
          >
            Delete
          </button>
        )}
        <span className={styles.spacer} />
        <button type="button" onClick={close}>
          Cancel
        </button>
        <button type="submit" className={styles.save} disabled={!canSave} title="Save (Ctrl+Enter)">
          Save
        </button>
      </footer>
    </form>
  );
}

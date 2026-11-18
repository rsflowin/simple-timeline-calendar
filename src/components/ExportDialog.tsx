import { useEffect, useId, useRef, useState } from 'react';
import { todayISO } from '../domain/dates';
import { selectTasks, toIcs } from '../domain/ics';
import { serializeRoadmap } from '../domain/schema';
import { downloadText } from '../storage/fileTransfer';
import { usePrefs } from '../store/prefsStore';
import { useDoc } from '../store/roadmapStore';
import { useStatus } from '../store/statusStore';
import { TagChip } from './TagChip';
import styles from './ExportDialog.module.css';

const FORMATS = [
  { value: 'json', label: 'JSON', hint: 'Backup; re-import with Import.' },
  { value: 'ics', label: 'iCalendar (.ics)', hint: 'Google Calendar: Settings → Import & export.' },
] as const;
type Format = (typeof FORMATS)[number]['value'];

/** Export dialog: JSON or .ics, filtered by date range and tags. */
export function ExportDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Export" onClose={onClose}>
      {/* mounted per open, so the form starts fresh from the current tag filter */}
      {open && <ExportForm onClose={onClose} />}
    </dialog>
  );
}

function ExportForm({ onClose }: { onClose(): void }) {
  const doc = useDoc();
  const [format, setFormat] = useState<Format>('json');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tagIds, setTagIds] = useState(() => {
    const filter = usePrefs.getState().tagFilter;
    return doc.tags.filter((t) => filter.includes(t.id)).map((t) => t.id);
  });
  const errorId = useId();

  const rangeError = from && to && from > to ? 'From must be on or before To.' : null;
  const opts = { from: from || undefined, to: to || undefined, tagIds };
  const tasks = selectTasks(doc, opts);
  const count = tasks.length;
  const toggle = (id: string) =>
    setTagIds(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]);

  const exportFile = () => {
    const name = `roadmap-${todayISO()}.${format}`;
    if (format === 'ics') downloadText(toIcs(doc, opts), name, 'text/calendar');
    // all tags are kept, so a filtered file still imports with every tag
    else downloadText(serializeRoadmap({ tasks, tags: doc.tags }), name);
    useStatus.getState().show(`Exported ${count} task${count === 1 ? '' : 's'} to ${name}.`);
    onClose();
  };

  return (
    <div className={styles.body}>
      <h2 className={styles.heading}>Export</h2>
      <div role="radiogroup" aria-label="Format" className={styles.formats}>
        {FORMATS.map((f) => (
          <label key={f.value} className={styles.option}>
            <input
              type="radio"
              name="format"
              checked={format === f.value}
              onChange={() => setFormat(f.value)}
            />
            <span>
              {f.label} <span className={styles.hint}>{f.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className={styles.range}>
        <label>
          From
          <input
            type="date"
            value={from}
            aria-invalid={rangeError !== null}
            aria-describedby={rangeError ? errorId : undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            aria-invalid={rangeError !== null}
            aria-describedby={rangeError ? errorId : undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <p className={styles.hint}>Leave a date empty for no limit.</p>
      {rangeError && (
        <p id={errorId} role="alert" className={styles.error}>
          {rangeError}
        </p>
      )}
      <fieldset className={styles.tags}>
        <legend>Tags (none checked = all tasks)</legend>
        {doc.tags.length === 0 && <p className={styles.hint}>No tags yet</p>}
        {doc.tags.map((t) => (
          <label key={t.id} className={styles.option}>
            <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(t.id)} />
            <TagChip tag={t} />
          </label>
        ))}
      </fieldset>
      <p aria-live="polite">
        {count} task{count === 1 ? '' : 's'} will be exported.
      </p>
      <footer className={styles.footer}>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={rangeError !== null || count === 0} onClick={exportFile}>
          Export
        </button>
      </footer>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { todayISO } from '../domain/dates';
import { selectTasks, toIcs } from '../domain/ics';
import { downloadText } from '../storage/fileTransfer';
import { usePrefs } from '../store/prefsStore';
import { useDoc } from '../store/roadmapStore';
import { useStatus } from '../store/statusStore';
import { TagChip } from './TagChip';
import styles from './ExportIcsDialog.module.css';

/** Export tasks as an .ics file (e.g. for Google Calendar import), filtered by date range and tags. */
export function ExportIcsDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Export .ics" onClose={onClose}>
      {/* mounted per open, so the form starts fresh from the current tag filter */}
      {open && <ExportForm onClose={onClose} />}
    </dialog>
  );
}

function ExportForm({ onClose }: { onClose(): void }) {
  const doc = useDoc();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tagIds, setTagIds] = useState(() => {
    const filter = usePrefs.getState().tagFilter;
    return doc.tags.filter((t) => filter.includes(t.id)).map((t) => t.id);
  });
  const errorId = useId();

  const rangeError = from && to && from > to ? 'From must be on or before To.' : null;
  const opts = { from: from || undefined, to: to || undefined, tagIds };
  const count = selectTasks(doc, opts).length;
  const toggle = (id: string) =>
    setTagIds(tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]);

  const exportIcs = () => {
    downloadText(toIcs(doc, opts), `roadmap-${todayISO()}.ics`, 'text/calendar');
    useStatus.getState().show(`Exported ${count} task${count === 1 ? '' : 's'} to .ics.`);
    onClose();
  };

  return (
    <div className={styles.body}>
      <h2 className={styles.heading}>Export .ics</h2>
      <p className={styles.hint}>
        Import the file in Google Calendar: Settings → Import &amp; export. Leave a date empty for
        no limit.
      </p>
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
        <button type="button" disabled={rangeError !== null || count === 0} onClick={exportIcs}>
          Export
        </button>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { EMPTY_DOC, mergeRoadmap } from '../domain/doc';
import { importIcs } from '../domain/ics';
import { parseRoadmap } from '../domain/schema';
import { flushAutosave } from '../storage/autosave';
import { pickTextFile } from '../storage/fileTransfer';
import { useRoadmap } from '../store/roadmapStore';
import { useStatus } from '../store/statusStore';
import styles from './ExportDialog.module.css';

type Mode = 'add' | 'replace';

const MODES = [
  {
    value: 'add',
    label: 'Add',
    hint: 'Keep current tasks and tags; add new tasks, update ones with the same id.',
  },
  { value: 'replace', label: 'Replace', hint: 'Remove every current task and tag first.' },
] as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * DATA-4: .json or .ics, added to or replacing the roadmap as one undo step. Returns false if the
 * picker was cancelled; an invalid file changes nothing.
 */
async function importFile(mode: Mode): Promise<boolean> {
  const text = await pickTextFile('.json,.ics,application/json,text/calendar');
  if (text === null) return false;
  const { show } = useStatus.getState();
  const { commit, history } = useRoadmap.getState();
  const isIcs = /^\s*BEGIN:VCALENDAR/i.test(text);
  try {
    if (mode === 'replace') {
      const doc = isIcs ? importIcs(EMPTY_DOC, text).doc : parseRoadmap(text);
      commit(() => doc);
      show(
        `Replaced the roadmap with ${plural(doc.tasks.length, 'task')} and ${plural(doc.tags.length, 'tag')}.`,
      );
    } else {
      const r = isIcs
        ? importIcs(history.present, text)
        : mergeRoadmap(history.present, parseRoadmap(text));
      if (r.added + r.updated) commit(() => r.doc);
      const skipped = r.skipped ? `; skipped ${plural(r.skipped, 'invalid item')}` : '';
      show(`Imported: ${r.added} added, ${r.updated} updated${skipped}.`);
    }
    flushAutosave();
  } catch (err) {
    show(`Import failed: ${(err as Error).message}`);
  }
  return true;
}

/** Import dialog: choose Add or Replace, then a .json or .ics file. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>('add');

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Import" onClose={onClose}>
      {open && (
        <div className={styles.body}>
          <h2 className={styles.heading}>Import</h2>
          <p className={styles.hint}>JSON (from Export) or iCalendar (.ics).</p>
          <div role="radiogroup" aria-label="Mode" className={styles.formats}>
            {MODES.map((m) => (
              <label key={m.value} className={styles.option}>
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                <span>
                  {m.label} <span className={styles.hint}>{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <footer className={styles.footer}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            {/* stays open if the picker is cancelled, so the user can try again */}
            <button
              type="button"
              onClick={() => void importFile(mode).then((picked) => picked && onClose())}
            >
              Choose file…
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}

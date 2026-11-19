import { useEffect, useRef } from 'react';
import { useUi } from '../store/uiStore';
import styles from './ShortcutsDialog.module.css';

const SHORTCUTS: readonly (readonly [keys: string[], what: string])[] = [
  [['N'], 'New task'],
  [['T'], 'Go to today'],
  [['A'], 'Show or hide the agenda'],
  [['1', '2', '3'], 'Timeline zoom: Day, Week, Month'],
  [['Enter'], 'Edit the selected task (or double-click it)'],
  [['Delete'], 'Delete the selected task'],
  [['Ctrl', 'Z'], 'Undo'],
  [['Ctrl', 'Shift', 'Z'], 'Redo (also Ctrl + Y)'],
  [['Ctrl', 'Enter'], 'Save, in the task dialog'],
  [['Esc'], 'Close, or clear the selection'],
  [['?'], 'Show this list'],
];

/** Keyboard shortcut sheet, open while `uiStore.shortcutsOpen`. Mount once. */
export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => useUi.getState().setShortcutsOpen(false);

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label="Keyboard shortcuts" onClose={close}>
      <div className={styles.body}>
        <h2 className={styles.heading}>Keyboard shortcuts</h2>
        <dl className={styles.list}>
          {SHORTCUTS.map(([keys, what]) => (
            <div key={what} className={styles.row}>
              <dt>
                {keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && (keys[0] === '1' ? ' ' : ' + ')}
                    <kbd className={styles.kbd}>{k}</kbd>
                  </span>
                ))}
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
        <footer className={styles.footer}>
          <button type="button" autoFocus onClick={close}>
            Close
          </button>
        </footer>
      </div>
    </dialog>
  );
}

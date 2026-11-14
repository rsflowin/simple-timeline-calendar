import { useRef, useState } from 'react';
import { fromDayIndex, toDayIndex } from '../../domain/dates';
import type { Zoom } from '../../domain/scale';
import { usePrefs, type CalendarMode, type ViewMode } from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { calendarTitle, stepCursor } from '../../views/calendar/nav';
import { Popover } from '../Popover';
import { TagFilter } from '../TagFilter';
import { TagManager } from '../TagManager';
import styles from './Toolbar.module.css';

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange(value: T): void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.segmented}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}

const VIEWS: readonly (readonly [ViewMode, string])[] = [
  ['timeline', 'Timeline'],
  ['calendar', 'Calendar'],
];

const ZOOMS: readonly (readonly [Zoom, string])[] = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
];

const MODES: readonly (readonly [CalendarMode, string])[] = [
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
];

export function Toolbar({ onToday }: { onToday(): void }) {
  const view = usePrefs((s) => s.view);
  const zoom = usePrefs((s) => s.zoom);
  const mode = usePrefs((s) => s.calendarMode);
  const cursor = toDayIndex(usePrefs((s) => s.cursor));
  const packRows = usePrefs((s) => s.packRows);
  const setPrefs = usePrefs((s) => s.set);
  const canUndo = useRoadmap((s) => s.history.past.length > 0);
  const canRedo = useRoadmap((s) => s.history.future.length > 0);
  const undo = useRoadmap((s) => s.undo);
  const redo = useRoadmap((s) => s.redo);
  const openNew = useUi((s) => s.openNew);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [managing, setManaging] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  const closeMenu = () => {
    setMenu(null);
    menuButton.current?.focus();
  };
  /** Closes the menu first, so focus is back on its button before `action` opens anything. */
  const pick = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <header className={styles.toolbar}>
      <Segmented
        label="View"
        options={VIEWS}
        value={view}
        onChange={(v) => setPrefs({ view: v })}
      />
      {view === 'timeline' && (
        <>
          <Segmented
            label="Zoom"
            options={ZOOMS}
            value={zoom}
            onChange={(z) => setPrefs({ zoom: z })}
          />
          <button type="button" onClick={onToday}>
            Today
          </button>
        </>
      )}
      {view === 'calendar' && (
        <>
          <button type="button" onClick={onToday}>
            Today
          </button>
          <button
            type="button"
            aria-label={`Previous ${mode}`}
            onClick={() => setPrefs({ cursor: fromDayIndex(stepCursor(mode, cursor, -1)) })}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={`Next ${mode}`}
            onClick={() => setPrefs({ cursor: fromDayIndex(stepCursor(mode, cursor, 1)) })}
          >
            ›
          </button>
          <span className={styles.title} aria-live="polite">
            {calendarTitle(mode, cursor)}
          </span>
          <Segmented
            label="Calendar mode"
            options={MODES}
            value={mode}
            onChange={(m) => setPrefs({ calendarMode: m })}
          />
        </>
      )}
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={packRows}
        onClick={() => setPrefs({ packRows: !packRows })}
      >
        Pack rows
      </button>
      <TagFilter />
      <div className={styles.spacer} />
      <div role="group" aria-label="History" className={styles.history}>
        <button type="button" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button type="button" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
      </div>
      <button
        type="button"
        className={styles.primary}
        onClick={() => openNew()}
        title="New task (N)"
      >
        + New task
      </button>
      <button
        ref={menuButton}
        type="button"
        aria-label="Menu"
        aria-expanded={menu !== null}
        title="Menu"
        // Without this, the popover's outside-pointerdown closes it and the click reopens it.
        onPointerDown={(e) => menu && e.stopPropagation()}
        onClick={(e) => (menu ? closeMenu() : setMenu(e.currentTarget.getBoundingClientRect()))}
      >
        ⋯
      </button>
      {menu && (
        <Popover anchor={menu} label="Menu" onClose={closeMenu}>
          <div className={styles.menu}>
            <button type="button" autoFocus onClick={() => pick(() => setManaging(true))}>
              Manage tags
            </button>
          </div>
        </Popover>
      )}
      <TagManager open={managing} onClose={() => setManaging(false)} />
    </header>
  );
}

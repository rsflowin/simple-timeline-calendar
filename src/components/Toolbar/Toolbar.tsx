import { useId, useRef, useState, type ReactNode } from 'react';
import { fromDayIndex, todayISO, toDayIndex } from '../../domain/dates';
import type { TagRowMode } from '../../domain/packRows';
import { parseRoadmap, serializeRoadmap } from '../../domain/schema';
import type { Zoom } from '../../domain/scale';
import {
  usePrefs,
  type CalendarMode,
  type DragBehavior,
  type ViewMode,
} from '../../store/prefsStore';
import { flushAutosave } from '../../storage/autosave';
import { downloadText, pickTextFile } from '../../storage/fileTransfer';
import { useRoadmap } from '../../store/roadmapStore';
import { useStatus } from '../../store/statusStore';
import { useUi } from '../../store/uiStore';
import { calendarTitle, stepCursor } from '../../views/calendar/nav';
import { ExportIcsDialog } from '../ExportIcsDialog';
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

const TAG_ROW_OPTIONS: readonly {
  value: TagRowMode;
  short: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'dedicated',
    short: 'Dedicated',
    label: 'Dedicated lines per tag',
    description: 'Keep each tag on its own line; overlapping same-tag tasks use extra lines.',
  },
  {
    value: 'compact',
    short: 'Compact',
    label: 'Tag-first compact packing',
    description: 'Group same-tag tasks on one line; allow non-overlapping tags to share lines.',
  },
];

const DRAG_BEHAVIOR_OPTIONS: readonly {
  value: DragBehavior;
  short: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'none',
    short: 'Off',
    label: 'Do nothing',
    description: 'Ignore drags on empty space and task bars.',
  },
  {
    value: 'scroll',
    short: 'Scroll',
    label: 'Move scroll',
    description: 'Drag anywhere on the view to pan and scroll.',
  },
  {
    value: 'task',
    short: 'Tasks',
    label: 'Move task or create new task',
    description: 'Drag empty space to create; drag a task to move or resize.',
  },
];

function Submenu({
  id,
  title,
  onBack,
  children,
}: {
  id: string;
  title: string;
  onBack(): void;
  children: ReactNode;
}) {
  return (
    <div
      key={id}
      className={styles.submenu}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
          e.stopPropagation();
          onBack();
        }
      }}
    >
      <div className={styles.submenuHead}>
        <button
          type="button"
          autoFocus
          className={styles.back}
          aria-label="Back to Menu"
          onClick={onBack}
        >
          ‹ Back
        </button>
        <span className={styles.submenuTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function exportJson() {
  downloadText(
    serializeRoadmap(useRoadmap.getState().history.present),
    `roadmap-${todayISO()}.json`,
  );
}

/** DATA-4: a valid file replaces the roadmap as one undo step; an invalid one changes nothing. */
async function importJson() {
  const text = await pickTextFile();
  if (text === null) return;
  const { show } = useStatus.getState();
  try {
    const doc = parseRoadmap(text);
    useRoadmap.getState().commit(() => doc);
    flushAutosave();
    show(`Imported ${plural(doc.tasks.length, 'task')} and ${plural(doc.tags.length, 'tag')}.`);
  } catch (err) {
    show(`Import failed: ${(err as Error).message}`);
  }
}

export function Toolbar({ onToday }: { onToday(): void }) {
  const view = usePrefs((s) => s.view);
  const zoom = usePrefs((s) => s.zoom);
  const mode = usePrefs((s) => s.calendarMode);
  const cursor = toDayIndex(usePrefs((s) => s.cursor));
  const packRows = usePrefs((s) => s.packRows);
  const tagRowMode = usePrefs((s) => s.tagRowMode);
  const clickCreate = usePrefs((s) => s.clickCreate);
  const dragBehavior = usePrefs((s) => s.dragBehavior);
  const agendaOpen = usePrefs((s) => s.agendaOpen);
  const setPrefs = usePrefs((s) => s.set);
  const canUndo = useRoadmap((s) => s.history.past.length > 0);
  const canRedo = useRoadmap((s) => s.history.future.length > 0);
  const undo = useRoadmap((s) => s.undo);
  const redo = useRoadmap((s) => s.redo);
  const openNew = useUi((s) => s.openNew);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [submenu, setSubmenu] = useState<'root' | 'tag-display' | 'mouse-drag'>('root');
  const [managing, setManaging] = useState(false);
  const [exportingIcs, setExportingIcs] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dragGroupId = useId();

  const closeMenu = () => {
    setMenu(null);
    setSubmenu('root');
    menuButton.current?.focus();
  };
  const openMenu = (rect: DOMRect) => {
    setSubmenu('root');
    setMenu(rect);
  };
  /** Closes the menu first, so focus is back on its button before `action` opens anything. */
  const pick = (action: () => void) => {
    closeMenu();
    action();
  };
  const currentTagDisplay =
    TAG_ROW_OPTIONS.find((o) => o.value === tagRowMode)?.short ?? TAG_ROW_OPTIONS[0].short;
  const currentDragLabel =
    DRAG_BEHAVIOR_OPTIONS.find((o) => o.value === dragBehavior)?.short ??
    DRAG_BEHAVIOR_OPTIONS[2].short;

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
      <button
        type="button"
        className={styles.toggle}
        aria-pressed={agendaOpen}
        title="Today's tasks (A)"
        onClick={() => setPrefs({ agendaOpen: !agendaOpen })}
      >
        Today&apos;s tasks
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
        onClick={(e) => (menu ? closeMenu() : openMenu(e.currentTarget.getBoundingClientRect()))}
      >
        ⋯
      </button>
      {menu && (
        <Popover anchor={menu} label="Menu" onClose={closeMenu}>
          <div className={styles.panel}>
            {submenu === 'root' ? (
              <div key="root" className={styles.menu}>
                <button
                  type="button"
                  autoFocus
                  className={styles.menuItem}
                  onClick={() => pick(() => setManaging(true))}
                >
                  <span>Manage tags</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  aria-haspopup="true"
                  onClick={() => setSubmenu('tag-display')}
                >
                  <span>Tag display</span>
                  <span className={styles.meta}>{currentTagDisplay} ›</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  aria-haspopup="true"
                  onClick={() => setSubmenu('mouse-drag')}
                >
                  <span>Mouse &amp; drag</span>
                  <span className={styles.meta}>{currentDragLabel} ›</span>
                </button>
                <button type="button" className={styles.menuItem} onClick={() => pick(exportJson)}>
                  <span>Export JSON</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(() => setExportingIcs(true))}
                >
                  <span>Export .ics</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(() => void importJson())}
                >
                  <span>Import JSON</span>
                </button>
              </div>
            ) : submenu === 'tag-display' ? (
              <Submenu id="tag-display" title="Tag display" onBack={() => setSubmenu('root')}>
                <div role="radiogroup" aria-label="Tag display" className={styles.radioGroup}>
                  {TAG_ROW_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`${styles.radioOption} ${tagRowMode === opt.value ? styles.selected : ''}`}
                    >
                      <input
                        type="radio"
                        name="tagRowMode"
                        checked={tagRowMode === opt.value}
                        onChange={() => setPrefs({ tagRowMode: opt.value })}
                      />
                      <span className={styles.radioText}>
                        <span className={styles.radioLabel}>{opt.label}</span>
                        <span className={styles.radioDesc}>{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {!packRows && <p className={styles.note}>Applies when Pack rows is enabled.</p>}
              </Submenu>
            ) : (
              <Submenu id="mouse-drag" title="Mouse & drag" onBack={() => setSubmenu('root')}>
                <label className={`${styles.radioOption} ${clickCreate ? styles.selected : ''}`}>
                  <input
                    type="checkbox"
                    checked={clickCreate}
                    onChange={(e) => setPrefs({ clickCreate: e.target.checked })}
                  />
                  <span className={styles.radioText}>
                    <span className={styles.radioLabel}>Click empty space to create</span>
                    <span className={styles.radioDesc}>
                      Open quick-create on a single left-click.
                    </span>
                  </span>
                </label>
                <div id={dragGroupId} className={styles.sectionLabel}>
                  Drag and drop
                </div>
                <div role="radiogroup" aria-labelledby={dragGroupId} className={styles.radioGroup}>
                  {DRAG_BEHAVIOR_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`${styles.radioOption} ${dragBehavior === opt.value ? styles.selected : ''}`}
                    >
                      <input
                        type="radio"
                        name="dragBehavior"
                        checked={dragBehavior === opt.value}
                        onChange={() => setPrefs({ dragBehavior: opt.value })}
                      />
                      <span className={styles.radioText}>
                        <span className={styles.radioLabel}>{opt.label}</span>
                        <span className={styles.radioDesc}>{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.note}>Clicking a task bar always opens it to edit.</p>
              </Submenu>
            )}
          </div>
        </Popover>
      )}
      <TagManager open={managing} onClose={() => setManaging(false)} />
      <ExportIcsDialog open={exportingIcs} onClose={() => setExportingIcs(false)} />
    </header>
  );
}

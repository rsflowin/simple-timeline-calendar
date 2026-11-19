import { useId, useRef, useState, type ReactNode } from 'react';
import { toDayIndex } from '../../domain/dates';
import type { TagRowMode } from '../../domain/packRows';
import type { Zoom } from '../../domain/scale';
import {
  usePrefs,
  type CalendarMode,
  type DragBehavior,
  type ViewMode,
} from '../../store/prefsStore';
import { useRoadmap } from '../../store/roadmapStore';
import { useUi } from '../../store/uiStore';
import { calendarTitle } from '../../views/calendar/nav';
import { ExportDialog } from '../ExportDialog';
import { Icon } from '../Icon';
import { ImportDialog } from '../ImportDialog';
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

const TAG_ROW_OPTIONS: readonly { value: TagRowMode; label: string; description: string }[] = [
  {
    value: 'dedicated',
    label: 'One row per tag',
    description: 'Each tag gets its own rows; overlapping tasks of a tag add rows.',
  },
  {
    value: 'compact',
    label: 'Pack tags together',
    description: "Tags whose tasks don't overlap share rows, to save space.",
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

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

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

/** A checkbox or radio laid out as a bordered option with a description. */
function Option({
  type,
  name,
  checked,
  disabled,
  indent,
  label,
  description,
  onChange,
}: {
  type: 'checkbox' | 'radio';
  name?: string;
  checked: boolean;
  disabled?: boolean;
  indent?: boolean;
  label: string;
  description: string;
  onChange(checked: boolean): void;
}) {
  return (
    <label
      className={cx(
        styles.radioOption,
        checked && styles.selected,
        disabled && styles.disabled,
        indent && styles.indent,
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.radioText}>
        <span className={styles.radioLabel}>{label}</span>
        <span className={styles.radioDesc}>{description}</span>
      </span>
    </label>
  );
}

/** Toolbar "Display" popover: how tasks are laid out in rows. */
function DisplayButton() {
  const view = usePrefs((s) => s.view);
  const packRows = usePrefs((s) => s.packRows);
  const tagRowMode = usePrefs((s) => s.tagRowMode);
  const groupLabels = usePrefs((s) => s.groupLabels);
  const setPrefs = usePrefs((s) => s.set);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setAnchor(null);
    button.current?.focus();
  };
  const headersApply = packRows && tagRowMode === 'dedicated';

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.iconText}
        aria-expanded={anchor !== null}
        title="Display options"
        // Without this, the popover's outside-pointerdown closes it and the click reopens it.
        onPointerDown={(e) => anchor && e.stopPropagation()}
        onClick={(e) => (anchor ? close() : setAnchor(e.currentTarget.getBoundingClientRect()))}
      >
        <Icon name="sliders" />
        <span className={styles.label}>Display</span>
      </button>
      {anchor && (
        <Popover anchor={anchor} label="Display" onClose={close}>
          <div className={cx(styles.panel, styles.submenu)}>
            <Option
              type="checkbox"
              checked={packRows}
              label="Pack rows"
              description="Tasks that don't overlap share a row."
              onChange={(v) => setPrefs({ packRows: v })}
            />
            <div role="radiogroup" aria-label="Tag rows" className={styles.radioGroup}>
              {TAG_ROW_OPTIONS.map((opt) => (
                <Option
                  key={opt.value}
                  type="radio"
                  name="tagRowMode"
                  indent
                  checked={tagRowMode === opt.value}
                  disabled={!packRows}
                  label={opt.label}
                  description={opt.description}
                  onChange={() => setPrefs({ tagRowMode: opt.value })}
                />
              ))}
            </div>
            <Option
              type="checkbox"
              checked={groupLabels}
              disabled={!headersApply}
              label="Show tag headers"
              description="Timeline: a label above each tag's rows."
              onChange={(v) => setPrefs({ groupLabels: v })}
            />
            {!headersApply && (
              <p className={styles.note}>Tag headers need Pack rows and One row per tag.</p>
            )}
            {headersApply && view === 'calendar' && (
              <p className={styles.note}>Tag headers show on the Timeline.</p>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

interface ToolbarProps {
  onToday(): void;
  /** ‹ / ›: the previous or next week, month or year (calendar) or stretch of the timeline. */
  onStep(dir: 1 | -1): void;
}

export function Toolbar({ onToday, onStep }: ToolbarProps) {
  const view = usePrefs((s) => s.view);
  const zoom = usePrefs((s) => s.zoom);
  const mode = usePrefs((s) => s.calendarMode);
  const cursor = toDayIndex(usePrefs((s) => s.cursor));
  const timelineTitle = useUi((s) => s.timelineTitle);
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
  const [submenu, setSubmenu] = useState<'root' | 'mouse-drag'>('root');
  const [managing, setManaging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
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
  const currentDragLabel =
    DRAG_BEHAVIOR_OPTIONS.find((o) => o.value === dragBehavior)?.short ??
    DRAG_BEHAVIOR_OPTIONS[2].short;
  const unit = view === 'calendar' ? mode : 'period';

  return (
    <header className={styles.toolbar}>
      {/* Where you are */}
      <div className={styles.group}>
        <Segmented
          label="View"
          options={VIEWS}
          value={view}
          onChange={(v) => setPrefs({ view: v })}
        />
        <div role="group" aria-label="Date navigation" className={styles.nav}>
          <button
            type="button"
            className={styles.icon}
            aria-label={`Previous ${unit}`}
            title={`Previous ${unit}`}
            onClick={() => onStep(-1)}
          >
            <Icon name="chevronLeft" />
          </button>
          <button type="button" onClick={onToday} title="Go to today (T)">
            Today
          </button>
          <button
            type="button"
            className={styles.icon}
            aria-label={`Next ${unit}`}
            title={`Next ${unit}`}
            onClick={() => onStep(1)}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
        <span className={styles.title} aria-live="polite">
          {view === 'calendar' ? calendarTitle(mode, cursor) : timelineTitle}
        </span>
      </div>
      <div className={styles.spacer} />
      {/* What you see */}
      <div className={styles.group}>
        {view === 'timeline' ? (
          <Segmented
            label="Zoom"
            options={ZOOMS}
            value={zoom}
            onChange={(z) => setPrefs({ zoom: z })}
          />
        ) : (
          <Segmented
            label="Calendar mode"
            options={MODES}
            value={mode}
            onChange={(m) => setPrefs({ calendarMode: m })}
          />
        )}
        <TagFilter />
        <DisplayButton />
        <button
          type="button"
          className={cx(styles.icon, styles.toggle)}
          aria-label="Agenda"
          aria-pressed={agendaOpen}
          title="Agenda: today's tasks (A)"
          onClick={() => setPrefs({ agendaOpen: !agendaOpen })}
        >
          <Icon name="panel" />
        </button>
      </div>
      <div className={styles.divider} />
      {/* What you do */}
      <div className={styles.group}>
        <div role="group" aria-label="History" className={styles.history}>
          <button
            type="button"
            className={styles.icon}
            disabled={!canUndo}
            onClick={undo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className={styles.icon}
            disabled={!canRedo}
            onClick={redo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Icon name="redo" />
          </button>
        </div>
        <button
          type="button"
          className={cx(styles.primary, styles.iconText)}
          onClick={() => openNew()}
          title="New task (N)"
        >
          <Icon name="plus" />
          New task
        </button>
        <button
          ref={menuButton}
          type="button"
          className={styles.icon}
          aria-label="Menu"
          aria-expanded={menu !== null}
          title="Menu"
          // Without this, the popover's outside-pointerdown closes it and the click reopens it.
          onPointerDown={(e) => menu && e.stopPropagation()}
          onClick={(e) => (menu ? closeMenu() : openMenu(e.currentTarget.getBoundingClientRect()))}
        >
          <Icon name="more" />
        </button>
      </div>
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
                  onClick={() => setSubmenu('mouse-drag')}
                >
                  <span>Mouse &amp; drag</span>
                  <span className={styles.meta}>{currentDragLabel} ›</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(() => useUi.getState().setShortcutsOpen(true))}
                >
                  <span>Keyboard shortcuts</span>
                  <kbd className={styles.kbd}>?</kbd>
                </button>
                <hr className={styles.sep} />
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(() => setExporting(true))}
                >
                  <span>Export…</span>
                  <span className={styles.meta}>JSON, .ics</span>
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => pick(() => setImporting(true))}
                >
                  <span>Import…</span>
                  <span className={styles.meta}>JSON, .ics</span>
                </button>
              </div>
            ) : (
              <Submenu id="mouse-drag" title="Mouse & drag" onBack={() => setSubmenu('root')}>
                <Option
                  type="checkbox"
                  checked={clickCreate}
                  label="Click empty space to create"
                  description="Open quick-create on a single left-click."
                  onChange={(v) => setPrefs({ clickCreate: v })}
                />
                <div id={dragGroupId} className={styles.sectionLabel}>
                  Drag and drop
                </div>
                <div role="radiogroup" aria-labelledby={dragGroupId} className={styles.radioGroup}>
                  {DRAG_BEHAVIOR_OPTIONS.map((opt) => (
                    <Option
                      key={opt.value}
                      type="radio"
                      name="dragBehavior"
                      checked={dragBehavior === opt.value}
                      label={opt.label}
                      description={opt.description}
                      onChange={() => setPrefs({ dragBehavior: opt.value })}
                    />
                  ))}
                </div>
                <p className={styles.note}>
                  Click a task to preview it; double-click it or press Enter to edit.
                </p>
              </Submenu>
            )}
          </div>
        </Popover>
      )}
      <TagManager open={managing} onClose={() => setManaging(false)} />
      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </header>
  );
}

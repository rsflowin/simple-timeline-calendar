import { create } from 'zustand';
import { todayISO, type ISODate } from '../domain/dates';
import type { TaskInput } from '../domain/doc';
import { usePrefs } from './prefsStore';

type Editing = { mode: 'new'; draft: TaskInput } | { mode: 'edit'; id: string } | null;

/** Transient UI state: not persisted, not undoable. */
interface UiState {
  editing: Editing;
  selectedId: string | null;
  quickCreate: { start: ISODate; end: ISODate; anchor: DOMRect } | null;
  /** Task shown in the side peek: a click on a bar previews it there. */
  peekId: string | null;
  /** Bar under the mouse, for the hover card. */
  hover: { id: string; anchor: DOMRect } | null;
  /** Month at the centre of the timeline, e.g. `November 2026`; the toolbar shows it. */
  timelineTitle: string;
  shortcutsOpen: boolean;
  /** Opens the Task dialog for a new task; dates default to today – today (TD-2), tags to the
   * active filter so the task doesn't vanish on save. */
  openNew(draft?: Partial<TaskInput>): void;
  openEdit(id: string): void;
  close(): void;
  select(id: string | null): void;
  openQuickCreate(qc: UiState['quickCreate']): void;
  closeQuickCreate(): void;
  peek(id: string | null): void;
  setHover(hover: UiState['hover']): void;
  setTimelineTitle(title: string): void;
  setShortcutsOpen(open: boolean): void;
}

export const useUi = create<UiState>()((set) => ({
  editing: null,
  selectedId: null,
  quickCreate: null,
  peekId: null,
  hover: null,
  timelineTitle: '',
  shortcutsOpen: false,
  openNew: (draft = {}) => {
    const today = todayISO();
    set({
      editing: {
        mode: 'new',
        draft: {
          title: '',
          details: '',
          start: today,
          end: today,
          tagIds: usePrefs.getState().tagFilter,
          ...draft,
        },
      },
    });
  },
  openEdit: (id) => set({ editing: { mode: 'edit', id } }),
  close: () => set({ editing: null }),
  select: (selectedId) => set({ selectedId }),
  openQuickCreate: (quickCreate) => set({ quickCreate }),
  closeQuickCreate: () => set({ quickCreate: null }),
  peek: (peekId) => set({ peekId }),
  setHover: (hover) => set({ hover }),
  setTimelineTitle: (timelineTitle) => set({ timelineTitle }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}));

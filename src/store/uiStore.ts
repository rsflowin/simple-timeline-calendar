import { create } from 'zustand';
import { todayISO, type ISODate } from '../domain/dates';
import type { TaskInput } from '../domain/doc';

type Editing = { mode: 'new'; draft: TaskInput } | { mode: 'edit'; id: string } | null;

/** Transient UI state: not persisted, not undoable. */
interface UiState {
  editing: Editing;
  selectedId: string | null;
  quickCreate: { start: ISODate; end: ISODate; anchor: DOMRect } | null;
  /** Opens the Task dialog for a new task; dates default to today – today (TD-2). */
  openNew(draft?: Partial<TaskInput>): void;
  openEdit(id: string): void;
  close(): void;
  select(id: string | null): void;
  openQuickCreate(qc: UiState['quickCreate']): void;
  closeQuickCreate(): void;
}

export const useUi = create<UiState>()((set) => ({
  editing: null,
  selectedId: null,
  quickCreate: null,
  openNew: (draft = {}) => {
    const today = todayISO();
    set({
      editing: {
        mode: 'new',
        draft: { title: '', details: '', start: today, end: today, tagIds: [], ...draft },
      },
    });
  },
  openEdit: (id) => set({ editing: { mode: 'edit', id } }),
  close: () => set({ editing: null }),
  select: (selectedId) => set({ selectedId }),
  openQuickCreate: (quickCreate) => set({ quickCreate }),
  closeQuickCreate: () => set({ quickCreate: null }),
}));

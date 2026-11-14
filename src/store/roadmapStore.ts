import { create } from 'zustand';
import { EMPTY_DOC } from '../domain/doc';
import { initHistory, pushHistory, redo, undo, type History } from '../domain/history';
import type { RoadmapDoc } from '../domain/types';

interface RoadmapState {
  history: History<RoadmapDoc>;
  /** One call = one undo step. Throws (and changes nothing) if `update` throws. */
  commit(update: (doc: RoadmapDoc) => RoadmapDoc): void;
  /** Replace without history — for loading at startup. Import uses commit instead. */
  reset(doc: RoadmapDoc): void;
  undo(): void;
  redo(): void;
}

export const useRoadmap = create<RoadmapState>()((set, get) => ({
  history: initHistory(EMPTY_DOC),
  commit: (update) => {
    const h = get().history;
    set({ history: pushHistory(h, update(h.present)) });
  },
  reset: (doc) => set({ history: initHistory(doc) }),
  undo: () => set((s) => ({ history: undo(s.history) })),
  redo: () => set((s) => ({ history: redo(s.history) })),
}));

export const useDoc = () => useRoadmap((s) => s.history.present);

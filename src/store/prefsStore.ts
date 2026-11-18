import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, type ISODate } from '../domain/dates';
import type { TagRowMode } from '../domain/packRows';
import type { Zoom } from '../domain/scale';

export type ViewMode = 'timeline' | 'calendar';
export type CalendarMode = 'week' | 'month' | 'year';
export type DragBehavior = 'none' | 'scroll' | 'task';

interface Prefs {
  view: ViewMode;
  zoom: Zoom;
  calendarMode: CalendarMode;
  /** Date the calendar is showing. Not persisted: the app opens on today. */
  cursor: ISODate;
  packRows: boolean;
  tagRowMode: TagRowMode;
  tagFilter: string[];
  clickCreate: boolean;
  dragBehavior: DragBehavior;
  /** Today's tasks side panel. */
  agendaOpen: boolean;
  set(patch: Partial<Omit<Prefs, 'set'>>): void;
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      view: 'timeline',
      zoom: 'week',
      calendarMode: 'month',
      cursor: todayISO(),
      packRows: true,
      tagRowMode: 'dedicated',
      tagFilter: [],
      clickCreate: true,
      dragBehavior: 'task',
      agendaOpen: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'timeline-calendar:prefs',
      partialize: ({
        view,
        zoom,
        calendarMode,
        packRows,
        tagRowMode,
        tagFilter,
        clickCreate,
        dragBehavior,
        agendaOpen,
      }) => ({
        view,
        zoom,
        calendarMode,
        packRows,
        tagRowMode,
        tagFilter,
        clickCreate,
        dragBehavior,
        agendaOpen,
      }),
    },
  ),
);

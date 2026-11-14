import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, type ISODate } from '../domain/dates';
import type { Zoom } from '../domain/scale';

export type ViewMode = 'timeline' | 'calendar';
export type CalendarMode = 'week' | 'month' | 'year';

interface Prefs {
  view: ViewMode;
  zoom: Zoom;
  calendarMode: CalendarMode;
  /** Date the calendar is showing. Not persisted: the app opens on today. */
  cursor: ISODate;
  packRows: boolean;
  tagFilter: string[];
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
      tagFilter: [],
      set: (patch) => set(patch),
    }),
    {
      name: 'timeline-calendar:prefs',
      partialize: ({ view, zoom, calendarMode, packRows, tagFilter }) => ({
        view,
        zoom,
        calendarMode,
        packRows,
        tagFilter,
      }),
    },
  ),
);

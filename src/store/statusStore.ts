import { create } from 'zustand';

interface Status {
  message: string | null;
  /** Raw saved text that couldn't be read, so the banner can offer it for download (DATA-5).
   * Later messages keep it unless they pass `null`; `clear()` drops it. */
  unreadable: string | null;
  show(message: string, unreadable?: string | null): void;
  clear(): void;
}

export const useStatus = create<Status>()((set, get) => ({
  message: null,
  unreadable: null,
  show: (message, unreadable = get().unreadable) => set({ message, unreadable }),
  clear: () => set({ message: null, unreadable: null }),
}));

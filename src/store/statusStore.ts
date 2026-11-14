import { create } from 'zustand';

interface Status {
  message: string | null;
  /** Raw saved text that couldn't be read, so the banner can offer it for download. */
  unreadable: string | null;
  show(message: string, unreadable?: string | null): void;
  clear(): void;
}

export const useStatus = create<Status>()((set) => ({
  message: null,
  unreadable: null,
  show: (message, unreadable = null) => set({ message, unreadable }),
  clear: () => set({ message: null, unreadable: null }),
}));

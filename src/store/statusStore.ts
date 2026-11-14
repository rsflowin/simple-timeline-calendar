import { create } from 'zustand';

interface Status {
  message: string | null;
  show(msg: string): void;
  clear(): void;
}

export const useStatus = create<Status>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  clear: () => set({ message: null }),
}));

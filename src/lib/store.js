import { create } from "zustand";

export const useUiStore = create((set) => ({
  shwoSidebar: true,
  toggleSidebar: () => set((state) => ({ shwoSidebar: !state.shwoSidebar })),
}));

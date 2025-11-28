import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUiStore = create(
  persist(
    (set) => ({
      showSidebar: true,
      savePath: null,
      tree: null,
      activeFolder: null,
      autoSave: false,
      reload: 0,
      toggleSidebar: () =>
        set((state) => ({ showSidebar: !state.showSidebar })),
      openSidebar: () => set(() => ({ showSidebar: true })),
      setSavePath: (path) => set(() => ({ savePath: path })),
      setTree: (tree) => set(() => ({ tree })),
      setAutoSave: (autoSave) => set(() => ({ autoSave })),
      setActiveFolder: (fileName) =>
        set((state) => ({
          activeFolder: fileName,
          autoSave: false,
          reload: state.reload + 1,
        })),
      selectFolder: async () => {
        const data = await window.api.selectFolder();
        if (data.success) {
          set({
            savePath: data.path,
            tree: data.tree,
            activeFolder: null,
          });
        }
      },
    }),
    {
      name: "vortex-ui-states",
      partialize: (state) => ({
        savePath: state.savePath,
        showSidebar: state.showSidebar,
        activeFolder: state.activeFolder,
      }),
    }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useUiStore = create(
  persist(
    (set) => ({
      showSidebar: true,
      showSidebarRight: false,
      savePath: null,
      tree: null,
      activeFolder: null,
      autoSave: false,
      reload: 0,
      loading: false,
      scrollElement: null,
      toggleSidebar: () =>
        set((state) => ({ showSidebar: !state.showSidebar })),
      toggleRightSidebar: () =>
        set((state) => ({ showSidebarRight: !state.showSidebarRight })),
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
      setLoading: (loading) => set(() => ({ loading })),
      setScrollElement: (scrollElement) => set(() => ({ scrollElement })),
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

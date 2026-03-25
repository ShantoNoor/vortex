import { create } from "zustand";
import { persist } from "zustand/middleware";

export const uiStore = create(
  persist(
    (set) => ({
      showSidebar: true,
      showSidebarRight: false,
      savePath: null,
      tree: null,
      activeFolder: null,
      scrollElement: null,
      sceneLoaded: false,
      fileTransitionIntent: "open", // 'new' | 'open' | 'save',

      toggleSidebar: () =>
        set((state) => ({ showSidebar: !state.showSidebar })),
      toggleRightSidebar: () =>
        set((state) => ({ showSidebarRight: !state.showSidebarRight })),
      openSidebar: () => set(() => ({ showSidebar: true })),
      setSavePath: (path) => set(() => ({ savePath: path })),
      setTree: (tree) => set(() => ({ tree })),
      setSceneLoaded: (sceneLoaded) => set(() => ({ sceneLoaded })),
      setActiveFolder: (fileName, intent = "open") =>
        set((state) => ({
          activeFolder: fileName,
          fileTransitionIntent: intent,
          sceneLoaded: false,
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
      setScrollElement: (scrollElement) => set(() => ({ scrollElement })),
    }),
    {
      name: "vortex-ui-states",
      partialize: (state) => ({
        savePath: state.savePath,
        showSidebar: state.showSidebar,
        activeFolder: state.activeFolder,
      }),
    },
  ),
);

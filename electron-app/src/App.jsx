import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { uiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { useEffect, useRef, useState } from "react";
import TagSidebar from "./components/TagSidebar";
import { Toaster } from "./components/ui/sonner";
import Workspace from "./components/Workspace";

export default function App() {
  const {
    showSidebar,
    setTree,
    savePath,
    setSavePath,
    activeFolder,
    setActiveFolder,
    showSidebarRight,
    selectFolder,
    toggleRightSidebar,
    toggleSidebar,
  } = uiStore();

  const saved = useRef(false);

  useEffect(() => {
    async function run() {
      if (savePath !== null) {
        const data = await window.api.getFiles(savePath);
        if (data.success) {
          setTree(data.tree);
        } else {
          alert(`Failed to Open: ${savePath} try to open a valid folder`);
          setSavePath(null);
          setActiveFolder(null);
        }
      } else if (import.meta.env.VITE_API_URL) {
        await selectFolder();
      }
    }
    run();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "b") {
        toggleSidebar();
      } else if (e.key === "u") {
        toggleRightSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <title>
        {import.meta.env.VITE_ELECTRON
          ? activeFolder || "Select Folder"
          : "Vortex"}
      </title>

      <ResizablePanelGroup direction="horizontal" className="min-h-dvh">
        {showSidebar && (
          <>
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar"
              defaultSize={200}
              minSize={100}
              order={1}
            >
              <AppSidebar saved={saved} />
            </ResizablePanel>
            <ResizableHandle withHandle className="w-0.5 bg-[#333]" />
          </>
        )}
        <ResizablePanel id="main" order={2} className="relative">
          <Workspace saved={saved} />
        </ResizablePanel>
        {showSidebarRight && (
          <>
            <ResizableHandle withHandle className="w-0.5 bg-[#333]" />
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar-right"
              defaultSize={300}
              minSize={100}
              order={3}
            >
              <TagSidebar saved={saved} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <Toaster
        theme="dark"
        position="top-right"
        richColors={true}
        closeButton={true}
        toastOptions={{
          duration: 2500,
        }}
      />
    </>
  );
}

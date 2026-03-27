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
    addToRecents,
  } = uiStore();

  useEffect(() => {
    async function run() {
      if (savePath !== null) {
        const data = await window.api.getFiles(savePath);
        if (data.success) {
          setTree(data.tree);

          // adding the auto-opening file to recents
          const activeFolderSplitArray = activeFolder.split("/");
          const activeFolderBaseName =
            activeFolder.split("/")[activeFolderSplitArray.length - 1];
          const activeFolderIsPdf = activeFolder.toLowerCase().endsWith(".pdf");

          addToRecents({
            name: activeFolderBaseName,
            path: activeFolder,
            isPdf: activeFolderIsPdf,
          });
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
              minSize={10}
            >
              <AppSidebar />
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-[#333] focus-visible:ring-offset-0 focus-visible:ring-0"
            />
          </>
        )}
        <ResizablePanel id="main" className="relative">
          <Workspace />
        </ResizablePanel>
        {showSidebarRight && (
          <>
            <ResizableHandle
              withHandle
              className=" bg-[#333] focus-visible:ring-offset-0 focus-visible:ring-0"
            />
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar-right"
              defaultSize={300}
              minSize={100}
            >
              <TagSidebar />
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

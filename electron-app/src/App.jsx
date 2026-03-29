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
import { useDefaultLayout } from "react-resizable-panels";

function getLayoutIds(showSidebar, showSidebarRight) {
  if (showSidebar && showSidebarRight) {
    return ["sidebar", "main", "sidebar-right"];
  } else if (showSidebar) {
    return ["sidebar", "main"];
  } else if (showSidebarRight) {
    return ["main", "sidebar-right"];
  }
  return ["main"];
}

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

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "vortex-layout-id",
    storage: localStorage,
    panelIds: getLayoutIds(showSidebar, showSidebarRight),
  });

  useEffect(() => {
    async function run() {
      if (import.meta.env.VITE_API_URL) {
        await selectFolder();
      } else if (savePath !== null) {
        const data = await window.api.getFiles(savePath);
        if (data.success) {
          setTree(data.tree);
          console.log(data.path);

          if (data.path !== savePath) {
            setSavePath(data.path);
            setActiveFolder(null);
          }
        } else {
          alert(`Failed to Open: ${savePath} try to open a valid folder`);
          setSavePath(null);
          setActiveFolder(null);
        }
      }

      if (activeFolder) {
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

      <ResizablePanelGroup
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        direction="horizontal"
        className="min-h-dvh"
      >
        {showSidebar && (
          <>
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar"
              defaultSize={200}
              minSize={10}
              groupResizeBehavior="preserve-pixel-size"
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
              groupResizeBehavior="preserve-pixel-size"
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

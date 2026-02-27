import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { uiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { useEffect, useRef } from "react";
import { Loader } from "./components/Loader";
import TagSidebar from "./components/TagSidebar";

import { api, db } from "./react-app-bridge";
import { socket } from "./lib/socket";
import { Toaster } from "./components/ui/sonner";

if (import.meta.env.VITE_API_URL) {
  window.api = api;
  window.db = db;
}

export default function App() {
  const {
    showSidebar,
    setTree,
    savePath,
    setSavePath,
    loading,
    activeFolder,
    setActiveFolder,
    showSidebarRight,
    setLoadingFolder,
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
        setLoadingFolder(false);
      }
    }
    run();
  }, []);

  useEffect(() => {
    socket.on("receive-message", (data) => {
      if (data.message === "sync") {
        setActiveFolder(data.activeFolder);
      }
    });
  }, [socket]);

  return (
    <>
      <title>{activeFolder || "Select Folder"}</title>

      <ResizablePanelGroup
        autoSaveId="persistence"
        direction="horizontal"
        className="min-h-dvh"
      >
        {showSidebar && (
          <>
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar"
              defaultSize={20}
              order={1}
            >
              <AppSidebar saved={saved} />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}
        <ResizablePanel id="main" order={2}>
          <Editor saved={saved} />
        </ResizablePanel>
        {showSidebarRight && (
          <>
            <ResizableHandle />
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar-right"
              defaultSize={20}
              order={3}
            >
              <TagSidebar saved={saved} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {loading && (
        <div className="absolute inset-0 z-10">
          <Loader />
        </div>
      )}
      <Toaster
        theme="dark"
        position="top-right"
        richColors={true}
        closeButton={true}
        toastOptions={{
          duration: 1500,
        }}
      />
    </>
  );
}

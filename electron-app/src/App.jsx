import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { uiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { useEffect, useRef, useState } from "react";
import { Loader } from "./components/Loader";
import TagSidebar from "./components/TagSidebar";
import { Toaster } from "./components/ui/sonner";

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
  } = uiStore();

  const saved = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 10);
  }, [activeFolder]);

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
          {loading ? <Loader /> : <Editor saved={saved} />}
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

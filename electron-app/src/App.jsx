import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { uiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { useEffect } from "react";
import { Loader } from "./components/Loader";
import TagSidebar from "./components/TagSidebar";

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

  return (
    <>
      <title>{activeFolder || "Undefined"}</title>

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
              <AppSidebar />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}
        <ResizablePanel id="main" order={2}>
          <Editor />
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
              <TagSidebar />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      {loading && (
        <div className="absolute inset-0 z-10">
          <Loader />
        </div>
      )}
    </>
  );
}

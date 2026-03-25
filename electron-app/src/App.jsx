import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { uiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { useEffect, useRef, useState } from "react";
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
            <ResizableHandle />
          </>
        )}
        <ResizablePanel id="main" order={2} className="relative">
          <Editor key={activeFolder} saved={saved} />
        </ResizablePanel>
        {showSidebarRight && (
          <>
            <ResizableHandle />
            <ResizablePanel
              className="bg-[#111]"
              id="sidebar-right"
              defaultSize={300}
              minSize={300}
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

function PdfViewerPlaceholder({ fileId }) {
  return (
    <div className="flex-1 h-full w-full flex flex-col items-center justify-center bg-[#111] text-white absolute inset-0">
      <div className="text-6xl mb-4">📄</div>
      <h2 className="text-2xl font-semibold mb-2">PDF Viewer Placeholder</h2>
      <p className="text-neutral-400">
        Ready to render file:{" "}
        <span className="text-orange-400 font-mono text-sm ml-2">{fileId}</span>
      </p>
    </div>
  );
}

function DocumentWorkspace({ saved }) {
  const { activeFolder, fileTransitionIntent } = uiStore();
  const [sessionKey, setSessionKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    // If the user clicked a file in the sidebar ('open') or clicked 'New' ('new'),
    // we generate a new key to force a clean, fresh mount of the components.
    // If the intent is 'save', we do NOTHING, which keeps the Editor perfectly mounted!
    if (fileTransitionIntent === "new" || fileTransitionIntent === "open") {
      setSessionKey(crypto.randomUUID());
    }
  }, [activeFolder, fileTransitionIntent]);

  const isPdf = activeFolder?.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return <PdfViewerPlaceholder key={sessionKey} fileId={activeFolder} />;
  }

  // Uses sessionKey instead of activeFolder
  return <Editor key={sessionKey} saved={saved} />;
}

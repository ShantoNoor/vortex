import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { useUiStore } from "./lib/store";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect } from "react";

export default function App() {
  const { showSidebar, setTree, savePath } = useUiStore();

  useEffect(() => {
    async function run() {
      if (savePath !== null) {
        const data = await window.api.getFiles(savePath);
        if (data.success) {
          setTree(data.tree);
        }
      }
    }
    run();
  }, []);

  return (
    <SidebarProvider>
      <ResizablePanelGroup direction="horizontal" className="min-h-dvh">
        {showSidebar && (
          <>
            <ResizablePanel className="bg-[#111]" id="sidebar" defaultSize={25} order={1}>
              <AppSidebar />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}
        <ResizablePanel id="main" order={2}>
          <Editor />
        </ResizablePanel>
      </ResizablePanelGroup>
    </SidebarProvider>
  );
}

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "./components/Editor";
import { Sidebar } from "./components/Sidebar";
import { useUiStore } from "./lib/store";

export default function App() {
  const shwoSidebar = useUiStore((state) => state.shwoSidebar);

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="min-h-[100dvh]">
        {shwoSidebar && (
          <>
            <ResizablePanel id="sidebar" defaultSize={25} order={1}>
              <Sidebar />
            </ResizablePanel>
            <ResizableHandle withHandle className="bg-[#333]" />
          </>
        )}
        <ResizablePanel id="main" order={2}>
          <Editor />
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
}

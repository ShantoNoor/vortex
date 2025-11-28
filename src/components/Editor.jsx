import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { PanelRightClose, Save, Sidebar } from "lucide-react";
import { useUiStore } from "../lib/store";
import { useEffect, useRef, useState } from "react";
import { Loader } from "./Loader";
import { Button } from "./ui/button";

const initialData = {
  appState: { viewBackgroundColor: "#222" },
};

export const Editor = () => {
  const timeoutId = useRef("");
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [loading, setLoading] = useState(true);

  const {
    toggleSidebar,
    setTree,
    activeFolder,
    setActiveFolder,
    savePath,
    autoSave,
    setAutoSave,
    reload,
  } = useUiStore();

  useEffect(() => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    }, 10);
  }, [activeFolder, reload]);

  useEffect(() => {
    async function run() {
      if (activeFolder && excalidrawAPI) {
        const data = await window.api.openFile(activeFolder);

        if (data.success) {
          excalidrawAPI.updateScene({
            elements: data.elements,
            appState: data.appState,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });

          excalidrawAPI.addFiles(data.files);
        }

        setAutoSave(true);
      }
    }
    run();
  }, [excalidrawAPI]);

  const handleSave = async (elements, appState, files) => {
    const data = await window.api.handleSave({
      activeFolder,
      elements,
      files,
      appState,
      savePath,
    });

    if (data.success && activeFolder === null) {
      setActiveFolder(data.activeFolder);
      const data2 = await window.api.getFiles(savePath);
      if (data2.success) {
        setTree(data2.tree);
      }
    }
  };

  const saveFile = async () => {
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    handleSave(elements, appState, files);
    setAutoSave(true);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Excalidraw
      excalidrawAPI={(api) => setExcalidrawAPI(api)}
      initialData={initialData}
      onChange={(elements, appState, files) => {
        if (activeFolder && autoSave) {
          if (timeoutId.current) {
            clearTimeout(timeoutId.current);
          }
          timeoutId.current = setTimeout(() => {
            handleSave(elements, appState, files);
          }, 250);
        }
      }}
    >
      <MainMenu>
        <MainMenu.Item icon={<Save />} onClick={saveFile}>
          Save
        </MainMenu.Item>
        <MainMenu.Item icon={<PanelRightClose />} onClick={toggleSidebar}>
          Toggle Sidebar
        </MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <Footer>
        <Button className="ml-2 p-4" variant="outline" onClick={toggleSidebar}>
          <Sidebar className="size-4" />
        </Button>
      </Footer>
    </Excalidraw>
  );
};

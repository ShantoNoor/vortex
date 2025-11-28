import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { ArrowLeftToLine, Sidebar } from "lucide-react";
import { useUiStore } from "../lib/store";
import { useEffect, useRef, useState } from "react";
import { Loader } from "./Loader";
import { Button } from "./ui/button";

let ids = new Set([]);

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
    ids = new Set([]);

    setTimeout(() => {
      setLoading(false);
    }, 10);
  }, [activeFolder, reload]);

  useEffect(() => {
    async function run() {
      if (activeFolder && excalidrawAPI) {
        excalidrawAPI.setToast({
          message: `Loading, please wait ...`,
          closable: false,
          duration: Infinity,
        });

        const data = await window.api.openFile(activeFolder);

        if (data.success) {
          ids = new Set(data.idList);

          excalidrawAPI.updateScene({
            elements: data.elements,
            appState: data.appState,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });

          excalidrawAPI.addFiles(data.files);
        }

        setAutoSave(true);
        excalidrawAPI.setToast(null);
      }
    }
    run();
  }, [excalidrawAPI]);

  const handleSave = async (elements, appState, files) => {
    const fileList = Object.values(files);
    const newlyAddedFiles = fileList.filter((file) => !ids.has(file.id));

    const {
      theme,
      currentChartType,
      currentItemBackgroundColor,
      currentItemEndArrowhead,
      currentItemFillStyle,
      currentItemFontFamily,
      currentItemFontSize,
      currentItemOpacity,
      currentItemRoughness,
      currentItemStrokeColor,
      currentItemRoundness,
      currentItemArrowType,
      currentItemStrokeStyle,
      currentItemStrokeWidth,
      currentItemTextAlign,
      gridSize,
      gridStep,
      gridModeEnabled,
      name,
      scrollX,
      scrollY,
      viewBackgroundColor,
      zenModeEnabled,
      zoom,
      viewModeEnabled,
      offsetLeft,
      offsetTop,
    } = appState;

    const data = await window.api.handleSave({
      activeFolder,
      elements,
      fileList: newlyAddedFiles,
      appState: {
        theme,
        currentChartType,
        currentItemBackgroundColor,
        currentItemEndArrowhead,
        currentItemFillStyle,
        currentItemFontFamily,
        currentItemFontSize,
        currentItemOpacity,
        currentItemRoughness,
        currentItemStrokeColor,
        currentItemRoundness,
        currentItemArrowType,
        currentItemStrokeStyle,
        currentItemStrokeWidth,
        currentItemTextAlign,
        gridSize,
        gridStep,
        gridModeEnabled,
        name,
        scrollX,
        scrollY,
        viewBackgroundColor,
        zenModeEnabled,
        zoom,
        viewModeEnabled,
        offsetLeft,
        offsetTop,
      },
      savePath,
    });

    if (data.success) {
      newlyAddedFiles.forEach((file) => ids.add(file.id));

      if (activeFolder === null) {
        setActiveFolder(data.activeFolder);
        const data2 = await window.api.getFiles(savePath);
        if (data2.success) {
          setTree(data2.tree);
        }
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

  const zoom = (v) => {
    excalidrawAPI.updateScene({
      appState: {
        zoom: {
          value: v,
        },
        scrollToContent: true,
      },
    });
  };

  const selectDirection = (d) => {
    const { selectedElementIds } = excalidrawAPI.getAppState();

    if (Object.keys(selectedElementIds).length > 0) {
      const selectedId = Object.keys(selectedElementIds)[0];
      const elements = excalidrawAPI.getSceneElements();
      const { x, y } = elements.find((e) => e.id === selectedId);

      const seletedIds = { ...selectedElementIds };
      elements
        .filter((e) => {
          if (d === "right") return e.x >= x;
          else if (d === "left") return e.x <= x;
          else if (d === "up") return e.y <= y;
          else if (d === "down") return e.y >= y;
        })
        .forEach((e) => {
          seletedIds[e.id] = true;
        });
      excalidrawAPI.updateScene({
        appState: {
          selectedElementIds: seletedIds,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "n") {
        zoom(15);
      } else if (e.key === "m") {
        zoom(1);
      } else if (e.key === ",") {
        selectDirection("left");
      } else if (e.key === ".") {
        selectDirection("right");
      } else if (e.key === ";") {
        selectDirection("up");
      } else if (e.key === "/") {
        selectDirection("down");
      } else if (e.key === "b") {
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [excalidrawAPI]);

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
          }, 500);
        }
      }}
    >
      <MainMenu>
        <MainMenu.Item
          icon={<ArrowLeftToLine strokeWidth={1.5} />}
          onClick={saveFile}
        >
          Save
        </MainMenu.Item>
        <MainMenu.Item
          icon={<Sidebar strokeWidth={1.5} />}
          onClick={toggleSidebar}
        >
          Toggle Sidebar
        </MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.LoadScene />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      <Footer>
        <Button
          className="ml-2 p-4 bg-[#28292c]! border! border-[#191919]!"
          variant="outline"
          onClick={toggleSidebar}
        >
          <Sidebar className="size-4" />
        </Button>
      </Footer>
    </Excalidraw>
  );
};

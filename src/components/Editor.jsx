import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import {
  ArrowLeftToLine,
  FileText,
  Images,
  LockKeyhole,
  LockKeyholeOpen,
  Sidebar,
} from "lucide-react";
import { useUiStore } from "../lib/store";
import { useEffect, useRef, useState } from "react";
import { Loader } from "./Loader";
import { Button } from "./ui/button";
import {
  fileToBase64,
  generateUUID,
  getCanvasBlob,
  getImageDimensions,
} from "../lib/utils";
import imageCompression from "browser-image-compression";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
pdfjsLib.GlobalWorkerOptions.enableWebGL = true;
const chunkWidth = 2000;

let ids = new Set([]);

const initialData = {
  appState: { viewBackgroundColor: "#222" },
};

export const Editor = () => {
  const timeoutId = useRef("");
  const imagesOpenRef = useRef(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);

  const {
    toggleSidebar,
    setTree,
    activeFolder,
    setActiveFolder,
    savePath,
    autoSave,
    setAutoSave,
    reload,
    setLoading: setLoader,
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
        setLoader(true);

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
        setLoader(false);
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

  const lockAllElements = () => {
    const elements = excalidrawAPI.getSceneElements();

    excalidrawAPI.updateScene({
      elements: elements.map((el) => {
        return {
          ...el,
          locked: true,
        };
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const unlockAllElements = () => {
    const elements = excalidrawAPI.getSceneElements();

    excalidrawAPI.updateScene({
      elements: elements.map((el) => {
        return {
          ...el,
          locked: false,
        };
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
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

  const insertImages = async (files, gap = 20) => {
    excalidrawAPI.setToast({
      message: `Inserting Images ...`,
      closable: false,
      duration: Infinity,
    });

    let x = 0;
    let y = 0;

    const filesArray = [];
    const elementsArray = [];

    const options = {
      maxSizeMB: 1,
      useWebWorker: true,
    };

    for (const file of files) {
      const fileToAdd = await imageCompression(file, options);
      const base64 = await fileToBase64(fileToAdd);

      // Load image to get width and height
      let { width, height } = await getImageDimensions(base64);

      const imageId = generateUUID();
      const elementId = generateUUID();

      let scale = 1;
      if (gap === 0 && width < chunkWidth) {
        scale = chunkWidth / width;
        width = chunkWidth;
        height = height * scale;
      }

      const imageElement = {
        id: elementId,
        type: "image",
        x,
        y,
        width,
        height,
        angle: 0,
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        version: 1,
        versionNonce: Math.floor(Math.random() * 1000000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        status: "pending",
        fileId: imageId,
        scale: [1, 1],
        crop: null,
      };

      elementsArray.push(imageElement);

      filesArray.push({
        id: imageId,
        mimeType: file.type,
        dataURL: base64,
        created: Date.now(),
        lastRetrieved: Date.now(),
      });

      y += height + gap;
    }

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), ...elementsArray],
    });
    excalidrawAPI.addFiles(filesArray);

    excalidrawAPI.setToast({
      message: `Images inserted successfully!`,
      closable: true,
      duration: 2000,
    });
  };

  const handleImages = async (e) => {
    e.preventDefault();
    const files = e.target.files;
    if (!files.length) return;

    insertImages(files);
  };

  const handlePDFImport = async (e) => {
    setPdfOpen(false);
    e.preventDefault();

    const form = e.target;
    const file = form.pdfFile.files[0];
    const numSegments = form.segmentPerPage.value;

    if (file === undefined) {
      excalidrawAPI.setToast({
        message: "No file selected",
        closable: true,
        duration: 2000,
      });
      return;
    }

    excalidrawAPI.setToast({
      message: "Importing pdf ...",
      closable: false,
      duration: Infinity,
    });

    const images = [];

    try {
      const arrayBuffer = await file.arrayBuffer();

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const { width: pdf_width } = page.getViewport({
          scale: 1,
        });

        const scale = chunkWidth / pdf_width;
        const viewport = page.getViewport({ scale });

        const totalHeight = viewport.height;
        const totalWidth = viewport.width;

        const chunkHeight = totalHeight / numSegments;

        for (let i = 0; i < numSegments; i++) {
          const segmentCanvas = document.createElement("canvas");
          const ctx = segmentCanvas.getContext("2d");
          const segmentHeight = Math.min(
            chunkHeight,
            totalHeight - i * chunkHeight
          );

          segmentCanvas.width = totalWidth;
          segmentCanvas.height = segmentHeight;

          const transform = [1, 0, 0, 1, 0, Math.ceil(-i * chunkHeight)];

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
            transform: transform,
          }).promise;

          images.push(await getCanvasBlob(segmentCanvas, "image/jpeg"));
        }
      }

      excalidrawAPI.setToast({
        message: `PDF loaded! ${numPages} pages.`,
        closable: true,
        duration: 2000,
      });
      await insertImages(images, 0);
    } catch (error) {
      console.error("Error loading PDF:", error);
      excalidrawAPI.setToast({
        message: "Failed to load PDF.",
        closable: true,
        duration: 2000,
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
    <>
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
          <MainMenu.Item
            icon={<Images strokeWidth={1.5} />}
            onSelect={() => imagesOpenRef.current.click()}
          >
            Insert Images
          </MainMenu.Item>
          <MainMenu.Item
            icon={<FileText strokeWidth={1.5} />}
            onSelect={() => {
              setPdfOpen(true);
            }}
          >
            Import PDF
          </MainMenu.Item>
          <MainMenu.Item
            icon={<LockKeyhole strokeWidth={1.5} />}
            onClick={lockAllElements}
          >
            Lock All Elements
          </MainMenu.Item>
          <MainMenu.Item
            icon={<LockKeyholeOpen strokeWidth={1.5} />}
            onClick={unlockAllElements}
          >
            Unlock All Elements
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

      <Input
        ref={imagesOpenRef}
        type="file"
        multiple
        onChange={handleImages}
        accept="image/*"
        style={{
          display: "none",
        }}
      />

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import PDF</DialogTitle>
            <DialogDescription>Select a PDF File</DialogDescription>
          </DialogHeader>
          <form className="space-y-2" onSubmit={handlePDFImport}>
            <Label>Select PDF File</Label>
            <Input
              name="pdfFile"
              type="file"
              id="SelectPDF"
              accept="application/pdf"
            />
            <Label htmlFor="SegmentPerPage">Segment Par Page</Label>
            <Input
              name="segmentPerPage"
              type="number"
              id="SegmentPerPage"
              defaultValue={1}
              min={1}
            />
            <Button className="mt-2 w-full" variant="outline" type="submit">
              Import
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

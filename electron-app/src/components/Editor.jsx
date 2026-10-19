import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
  Sidebar,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import {
  ArrowDown,
  ArrowLeft,
  Save,
  ArrowRight,
  ChevronsDown,
  ChevronsRight,
  FileText,
  FolderSync,
  Images,
  LockKeyhole,
  LockKeyholeOpen,
  PanelRight,
  Pin,
  PinOff,
  Sidebar as SidebarIcon,
  Tag,
  Bandage,
} from "lucide-react";
import { uiStore } from "../lib/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader } from "./Loader";
import { Button } from "./ui/button";
import {
  boxDistance,
  fileToBase64,
  generateUUID,
  getBoundingBox,
  getCanvasBlob,
  getImageDimensions,
  isOverlapping,
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
import TagManager from "./TagManager";
import TagViewer from "./TagViewer";
import { checkHealth, socket } from "../lib/socket";
import { toast } from "sonner";
import { CopyButton } from "./CopyButton";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
pdfjsLib.GlobalWorkerOptions.enableWebGL = true;
const chunkWidth = 2000;

const batchSize = 10;
let ids = new Set([]);

// sm: 16, md: 20, lg: 28, xl: 36,
const initialData = {
  appState: {
    viewBackgroundColor: "#222",
    currentItemStrokeColor: "#c2255ccc",
    currentItemStrokeStyle: "solid",
    currentItemRoughness: 0, //Sloppiness
    currentItemRoundness: "sharp", //Edges
    currentItemStrokeWidth: 2,
    currentItemFontSize: 16,
  },
};

export const Editor = () => {
  const imagesOpenRef = useRef(null);
  const abortControllersRef = useRef({});

  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(null); // for element select operations
  const [tabHeader, setTabHeader] = useState("");
  const [pdfName, setPdfName] = useState(""); // for copying name of pdf file while importing pdf file
  const [loading, setLoading] = useState(true);
  const [loadingOpacity, setLoadingOpacity] = useState("1");
  const [legacyImportSize, setLegacyImportSize] = useState(false);
  const [pinned, setPinned] = useState(false);

  const {
    toggleSidebar,
    toggleRightSidebar,
    setTree,
    activeFolder,
    setActiveFolder,
    savePath,
    scrollElement,
    setScrollElement,
    sceneLoaded,
    setSceneLoaded,
    saved,
    setSaved,
    setTreeKey,
  } = uiStore();

  const getAbortSignal = useCallback((operationName) => {
    if (abortControllersRef.current[operationName]) {
      abortControllersRef.current[operationName].abort(); // Cancel previous if running
    }
    const controller = new AbortController();
    abortControllersRef.current[operationName] = controller;
    return controller.signal;
  }, []);

  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        controller.abort("Component unmounted");
      });
    };
  }, []);

  useEffect(() => {
    if (sceneLoaded && scrollElement) {
      excalidrawAPI.setViewport({ target: scrollElement, fit: "contain" });

      setScrollElement(null);
    }
  }, [sceneLoaded, scrollElement]);

  useEffect(() => {
    if (!socket || !excalidrawAPI) return;

    const handleMerge = ({ payload }) => {
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({
          elements: payload.elements,
          appState: payload.appState,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        excalidrawAPI.addFiles(payload.fileList);

        toast.info("Update merged!...");
      }
    };

    socket.on("merge", handleMerge);

    return () => {
      socket.off("merge", handleMerge);
    };
  }, [excalidrawAPI, socket]);

  const run = async (excalidrawAPI) => {
    const signal = getAbortSignal("run");

    ids = new Set([]);

    setLoadingOpacity("0.8");

    if (activeFolder) {
      excalidrawAPI.setToast({
        message: `Loading, please wait ...`,
        closable: false,
        duration: Infinity,
      });
      setLoading(true);

      let isActive = false;

      if (!import.meta.env.VITE_ANDROID_BUILD) {
        try {
          const roomRes = await fetch(
            import.meta.env.VITE_API_URL
              ? `${import.meta.env.VITE_API_URL}/is-room-active`
              : "http://localhost:55000/is-room-active",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                activeFolder: activeFolder,
              }),
              signal,
            },
          );

          const { active } = await roomRes.json();
          isActive = active;
        } catch (e) {
          if (e.name === "AbortError") return;
          console.error(e);
        }
      }

      if (signal.aborted) return;

      const data = await window.api.openFile({
        activeFolder,
        savePath,
        isActive, // used to programatically delete unwanted files...
      });

      if (signal.aborted) return;

      if (data.success) {
        ids = new Set(data.idList);

        excalidrawAPI.updateScene({
          elements: data.elements,
          appState: data.appState,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        setLegacyImportSize(data.appState?.legacyImportSize || false);

        if (!import.meta.env.VITE_ANDROID_BUILD) {
          excalidrawAPI.addFiles(data.files);
        } else {
          excalidrawAPI.setActiveTool({
            type: "hand",
          });
          excalidrawAPI.setToast({
            message: "Loading images ...",
            closable: false,
            duration: Infinity,
          });

          for (let i = 0; i < data.idList.length; i += batchSize) {
            if (signal.aborted) break;

            const chunk = data.idList.slice(i, i + batchSize);

            const files = await window.api.getImage({
              activeFolder,
              savePath,
              isActive,
              idList: chunk, // Sending the array of 10 IDs
            });

            if (signal.aborted) break;

            excalidrawAPI.addFiles(files);

            const currentCount = Math.min(i + batchSize, data.idList.length);
            excalidrawAPI.setToast({
              message: `Loading ${currentCount}/${data.idList.length} images...`,
              closable: true,
              duration: 1000,
            });
          }
        }

        if (!import.meta.env.VITE_ANDROID_BUILD)
          socket.emit("join-room", activeFolder);
      } else {
        setActiveFolder(null);
      }

      if (!signal.aborted) {
        excalidrawAPI.setToast(null);
      }
    }

    setSaved(true);
    setLoading(false);
    setSceneLoaded(true);
  };

  const handleSave = async (elements, appState, files) => {
    const signal = getAbortSignal("save");

    const tid = toast.loading("Saving, please wait ...");

    const fileList = Object.values(files);
    const newlyAddedFiles = fileList.filter((file) => !ids.has(file.id));

    const appStateToSave = {
      theme: appState.theme,
      currentChartType: appState.currentChartType,
      currentItemBackgroundColor: appState.currentItemBackgroundColor,
      currentItemEndArrowhead: appState.currentItemEndArrowhead,
      currentItemFillStyle: appState.currentItemFillStyle,
      currentItemFontFamily: appState.currentItemFontFamily,
      currentItemFontSize: appState.currentItemFontSize,
      currentItemOpacity: appState.currentItemOpacity,
      currentItemRoughness: appState.currentItemRoughness,
      currentItemStrokeColor: appState.currentItemStrokeColor,
      currentItemRoundness: appState.currentItemRoundness,
      currentItemArrowType: appState.currentItemArrowType,
      currentItemStrokeStyle: appState.currentItemStrokeStyle,
      currentItemStrokeWidth: appState.currentItemStrokeWidth,
      currentItemTextAlign: appState.currentItemTextAlign,
      gridSize: appState.gridSize,
      gridStep: appState.gridStep,
      gridModeEnabled: appState.gridModeEnabled,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      viewBackgroundColor: appState.viewBackgroundColor,
      zenModeEnabled: appState.zenModeEnabled,
      zoom: appState.zoom,
      viewModeEnabled: appState.viewModeEnabled,
      objectsSnapModeEnabled: appState.objectsSnapModeEnabled,
      bindMode: appState.bindMode,
      boxSelectionMode: appState.boxSelectionMode,
      legacyImportSize,
      isMidpointSnappingEnabled: appState.isMidpointSnappingEnabled,
      bindingPreference: appState.bindingPreference,
    };

    const data = await window.api.handleSave({
      activeFolder,
      elements,
      fileList: import.meta.env.VITE_ANDROID_BUILD ? [] : newlyAddedFiles,
      appState: appStateToSave,
      savePath,
    });

    if (signal.aborted) {
      toast.dismiss(tid);
      return;
    }

    if (data.success) {
      if (import.meta.env.VITE_ANDROID_BUILD && newlyAddedFiles.length > 0) {
        excalidrawAPI.setToast({
          message: `Saving images, please wait ...`,
          closable: false,
          duration: Infinity,
        });

        for (let i = 0; i < newlyAddedFiles.length; i += batchSize) {
          if (signal.aborted) break;

          const chunk = newlyAddedFiles.slice(i, i + batchSize);

          const res = await window.api.saveImage({
            activeFolder: data.activeFolder,
            fileList: chunk, // Sending the batch of 10
          });

          if (signal.aborted) break;

          chunk.forEach((file) => ids.add(file.id));

          const currentCount = Math.min(i + batchSize, newlyAddedFiles.length);
          excalidrawAPI.setToast({
            message: `Saved ${currentCount}/${newlyAddedFiles.length} images.`,
            closable: true,
            duration: 1000,
          });
        }
      } else {
        newlyAddedFiles.forEach((file) => ids.add(file.id));
      }

      if (activeFolder === null) {
        setActiveFolder(data.activeFolder, "save");
        setTreeKey(generateUUID());
      }

      if (!import.meta.env.VITE_ANDROID_BUILD)
        socket.emit("sync", {
          activeFolder,
          payload: {
            elements,
            fileList: newlyAddedFiles,
            appState: appStateToSave,
          },
        });

      if (!signal.aborted) {
        toast.dismiss(tid);
        toast.success("Saved!");
        setSaved(true);
      }
      return;
    }

    toast.dismiss(tid);
    toast.error(data?.error || "Failed to save!...");
  };

  const saveFile = async () => {
    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    handleSave(elements, appState, files);
  };

  const toggleLockOnAllExceptFreedrawElements = (locked) => {
    const elements = excalidrawAPI.getSceneElements();

    excalidrawAPI.updateScene({
      elements: elements.map((el) => {
        return el.type !== "freedraw"
          ? {
              ...el,
              locked,
            }
          : el;
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    excalidrawAPI.setToast({
      message: locked ? "Pinned" : "Unpinned",
      closable: true,
      duration: 2000,
    });
  };

  const toggleLockAllElements = (locked) => {
    const elements = excalidrawAPI.getSceneElements();

    excalidrawAPI.updateScene({
      elements: elements.map((el) => {
        return {
          ...el,
          locked,
        };
      }),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    excalidrawAPI.setToast({
      message: locked ? "All Locked" : "All Unlocked",
      closable: true,
      duration: 2000,
    });
  };

  const selectDirection = (d) => {
    const { selectedElementIds } = excalidrawAPI.getAppState();

    if (Object.keys(selectedElementIds).length > 0) {
      const selectedIds = Object.keys(selectedElementIds);
      const elements = excalidrawAPI.getSceneElements();
      let [x, y, maxx] = [Infinity, Infinity, -Infinity];

      selectedIds.forEach((id) => {
        const {
          x: ex,
          y: ey,
          width: ewidth,
        } = elements.find((e) => e.id === id);
        x = Math.min(x, ex);
        y = Math.min(y, ey);
        maxx = Math.max(maxx, ex + ewidth);
      });

      const nice = 100;
      const seletedIds = { ...selectedElementIds };
      elements
        .filter((e) => !e.locked)
        .filter((e) => {
          if (d === "right") return e.x >= x - nice;
          else if (d === "left") return e.x <= x + nice;
          else if (d === "up") return e.y <= y + nice;
          else if (d === "down") return e.y >= y - nice;
          else if (d === "slide_down")
            return e.y >= y && e.x >= x - nice && e.x + e.width <= maxx + nice;
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

  const autoSet = (d) => {
    const { selectedElementIds } = excalidrawAPI.getAppState();
    const selectedElementIdsArray = Object.keys(selectedElementIds);
    if (selectedElementIdsArray.length === 1) {
      const selectedId = selectedElementIdsArray[0];
      const elements = excalidrawAPI.getSceneElements();
      const selectedElement = elements.find((e) => e.id === selectedId);

      let nearestElement = null;
      let minDistance = Infinity;

      const selectedBox = getBoundingBox(selectedElement);
      elements.forEach((el) => {
        if (el.id === selectedElement.id || el.isDeleted) return;

        const otherBox = getBoundingBox(el);

        if (isOverlapping(selectedBox, otherBox)) return;

        const dist = boxDistance(selectedBox, otherBox);

        if (dist < minDistance) {
          minDistance = dist;
          nearestElement = el;
        }
      });

      if (nearestElement) {
        let selectedElementsNewElementBoundingBox = {};
        if (d === "down") {
          selectedElementsNewElementBoundingBox = {
            x: nearestElement.x,
            y: nearestElement.y + nearestElement.height + 5,
            width: nearestElement.width,
            height:
              (nearestElement.width / selectedElement.width) *
              selectedElement.height,
          };
        } else if (d === "right") {
          selectedElementsNewElementBoundingBox = {
            x: nearestElement.x + nearestElement.width + 100,
            y: nearestElement.y,
            width: nearestElement.width,
            height:
              (nearestElement.width / selectedElement.width) *
              selectedElement.height,
          };
        }

        excalidrawAPI.updateScene({
          elements: elements.map((el) =>
            el.id === selectedId
              ? {
                  ...el,
                  ...selectedElementsNewElementBoundingBox,
                }
              : el,
          ),
        });
      }
    }
  };

  const renderImage = (base64, x, y, gap, width, height, fileType) => {
    const imageId = generateUUID();
    const elementId = generateUUID();

    let scale = 1;
    if (gap === 0 && width < chunkWidth) {
      scale = chunkWidth / width;
      width = chunkWidth;
      height = height * scale;
    }

    width = legacyImportSize ? width : width / 3;
    height = legacyImportSize ? height : height / 3;

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

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), imageElement],
    });
    excalidrawAPI.addFiles([
      {
        id: imageId,
        mimeType: fileType,
        dataURL: base64,
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    ]);

    excalidrawAPI.setViewport({ target: imageElement, fit: "contain" });

    return height;
  };

  const insertImage = async (file, x, y, gap, signal) => {
    const options = {
      maxSizeMB: 1,
      useWebWorker: true,
      signal, // Native abort support for browser-image-compression
    };

    file = await imageCompression(file, options);
    if (signal?.aborted) return 0;

    const fileUrl = URL.createObjectURL(file);

    let { width, height } = await getImageDimensions(fileUrl);
    URL.revokeObjectURL(fileUrl);

    if (signal?.aborted) return 0;

    const base64 = await fileToBase64(file);

    if (signal?.aborted) return 0;

    return renderImage(base64, x, y, gap, width, height, file.type); // returns height
  };

  const insertImages = async (files, gap = 20) => {
    const signal = getAbortSignal("insertImages");

    excalidrawAPI.setToast({
      message: `Inserting Images ...`,
      closable: false,
      duration: Infinity,
    });
    setLoading(true);

    const elements = excalidrawAPI.getSceneElements();
    let [x, y, i] = [0, 0, 1];

    if (elements.length > 0) {
      x = elements[0]?.x;
      y = elements[0]?.y;
    }

    elements.forEach((el) => {
      const el_x = el.x + el.width;
      const el_y = el.y;
      if (x < el_x) x = el_x;
      if (y > el_y) y = el_y;
    });

    x += 100;

    for (const file of files) {
      if (signal.aborted) break; // Break loop if cancelled

      try {
        const height = await insertImage(file, x, y, gap, signal);
        if (signal.aborted) break;

        y += height + gap;

        excalidrawAPI.setToast({
          message: `Image ${i++}/${files.length} inserted successfully!`,
          closable: false,
          duration: Infinity,
        });
      } catch (error) {
        if (error.name === "AbortError") break;
        throw error; // Re-throw if it's a real error
      }
    }

    if (!signal.aborted) {
      setLoading(false);
      excalidrawAPI.setToast({
        message: `Images inserted successfully!`,
        closable: true,
        duration: 2000,
      });
    } else {
      setLoading(false);
      excalidrawAPI.setToast(null);
    }
  };

  const handleImages = async (e) => {
    e.preventDefault();
    const files = e.target.files;
    if (!files.length) return;

    try {
      await insertImages(files);
    } catch (error) {
      console.error("Error inserting images:", error);
      toast.error("Error inserting images" + error);
    } finally {
      // Safely trigger the Android cache cleanup
      if (import.meta.env.VITE_ANDROID_BUILD) {
        await window.api.clearImageCache();
      }

      e.target.value = null;
    }
  };

  const handlePDFImport = async (e) => {
    setPdfOpen(false);
    e.preventDefault();

    const signal = getAbortSignal("pdfImport");
    let loadingTask = null; // Declare up here to destroy on abort

    const form = e.target;
    const file = form.pdfFile.files[0];
    let numSegments = Number(form.segmentPerPage.value);

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

    setLoading(true);

    const elements = excalidrawAPI.getSceneElements();
    let [x, y] = [0, 0];

    if (elements.length > 0) {
      x = elements[0]?.x;
      y = elements[0]?.y;
    }

    elements.forEach((el) => {
      const el_x = el.x + el.width;
      const el_y = el.y;
      if (x < el_x) x = el_x;
      if (y > el_y) y = el_y;
    });

    x += 100;

    try {
      const arrayBuffer = await file.arrayBuffer();
      if (signal.aborted) return;

      loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const numPages = pdf.numPages;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (signal.aborted) {
          loadingTask.destroy();
          break; // Stop parsing pages
        }

        const page = await pdf.getPage(pageNum);
        const { width: pdf_width } = page.getViewport({
          scale: 1,
        });

        const scale = chunkWidth / pdf_width;
        const viewport = page.getViewport({ scale });

        const totalHeight = viewport.height;
        const totalWidth = viewport.width;

        const chunkHeight =
          numSegments === 0 ? 1130.65 : totalHeight / numSegments;

        if (numSegments === 0)
          numSegments = Math.ceil(totalHeight / chunkHeight);

        for (let i = 0; i < numSegments; i++) {
          if (signal.aborted) {
            page.cleanup();
            loadingTask.destroy();
            break;
          }

          const segmentCanvas = document.createElement("canvas");
          const ctx = segmentCanvas.getContext("2d");
          const segmentHeight = Math.min(
            chunkHeight,
            totalHeight - i * chunkHeight,
          );

          segmentCanvas.width = totalWidth;
          segmentCanvas.height = segmentHeight;

          const transform = [1, 0, 0, 1, 0, Math.ceil(-i * chunkHeight)];

          await page.render({
            canvasContext: ctx,
            viewport: viewport,
            transform: transform,
          }).promise;

          if (signal.aborted) break;

          // const imageFile = await getCanvasBlob(segmentCanvas, "image/jpeg");
          // const imageHeight = await insertImage(imageFile, x, y, 0, signal);

          const base64 = segmentCanvas.toDataURL("image/jpeg", 0.85);
          const imageHeight = await renderImage(
            base64,
            x,
            y,
            0,
            segmentCanvas.width,
            segmentCanvas.height,
            "image/jpeg",
          );
          y += imageHeight;

          segmentCanvas.width = 0;
          segmentCanvas.height = 0;

          excalidrawAPI.setToast({
            message: `PDF loading ${i + 1}/${numSegments} ${pageNum}/${numPages} pages.`,
            closable: true,
            duration: Infinity,
          });
        }

        page.cleanup();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (!signal.aborted) {
        excalidrawAPI.setToast({
          message: `PDF loaded! ${numPages} pages.`,
          closable: true,
          duration: 2000,
        });
      }
    } catch (error) {
      if (error.name === "AbortError" || signal.aborted) {
        console.error("PDF Import Aborted");
      } else {
        console.error("Error loading PDF:", error);
        excalidrawAPI.setToast({
          message: "Failed to load PDF.",
          closable: true,
          duration: 2000,
        });
      }
    } finally {
      if (loadingTask && signal.aborted) {
        try {
          loadingTask.destroy();
        } catch (e) {}
      }
      setLoading(false);
      if (signal.aborted) excalidrawAPI.setToast(null);
    }
  };

  const openTagWindow = () => {
    const { selectedElementIds } = excalidrawAPI.getAppState();
    const selectedElementIdsArray = Object.keys(selectedElementIds);
    if (selectedElementIdsArray.length === 1) {
      setSelectedElementId(selectedElementIdsArray[0]);
      setTabHeader(selectedElementIdsArray[0]);
      excalidrawAPI.toggleSidebar({ name: "tag", tab: "tag-manager" });
    } else {
      setTabHeader("Tags");
      excalidrawAPI.toggleSidebar({ name: "tag", tab: "tag-viewer" });
    }
  };

  useEffect(() => {
    let activeGamepadIndex = null;
    let previousButtonStates = [];
    let previousAxisStates = [];
    let animationFrameId;

    const AXIS_DEADZONE = 0.15;
    const TRIGGER_DEADZONE = 0.05;

    // --- endpoint editing ---
    const MIN_ELEMENT_SIZE = 1;
    const ENDPOINT_EDITABLE_TYPES = ["line", "arrow", "rectangle"];
    let endpointEditActive = false;

    let virtualMouseX = window.innerWidth / 2;
    let virtualMouseY = window.innerHeight / 2;
    let MOUSE_SPEED = 2;

    let cursorEl = document.getElementById("virtual-gamepad-cursor");
    if (!cursorEl) {
      cursorEl = document.createElement("div");
      cursorEl.id = "virtual-gamepad-cursor";
      cursorEl.style.position = "fixed";
      cursorEl.style.width = "10px";
      cursorEl.style.height = "10px";
      cursorEl.style.backgroundColor = "rgba(0, 0, 255, 0.8)";
      cursorEl.style.border = "1px solid white";
      cursorEl.style.borderRadius = "50%";
      cursorEl.style.pointerEvents = "none";
      cursorEl.style.zIndex = "999999";
      cursorEl.style.transform = "translate(-50%, -50%)";
      cursorEl.style.left = `${virtualMouseX}px`;
      cursorEl.style.top = `${virtualMouseY}px`;
      cursorEl.style.display = "none";
      document.body.appendChild(cursorEl);
    }

    let leftMouseClick = false;
    let rightMouseClick = false;
    const dispatchPointerEvent = (type, buttonCode) => {
      const target =
        document.elementFromPoint(virtualMouseX, virtualMouseY) ||
        document.body;
      const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: virtualMouseX,
        clientY: virtualMouseY,
        button: buttonCode,
        buttons: (leftMouseClick ? 1 : 0) | (rightMouseClick ? 2 : 0),
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
      });
      target.dispatchEvent(event);
    };

    /* ------------------------------------------------------------------ */
    /*  Endpoint editing helpers                                          */
    /* ------------------------------------------------------------------ */

    // If exactly one line / arrow / rectangle is selected, return it.
    const getEndpointEditTarget = () => {
      if (!excalidrawAPI) return null;

      const appState = excalidrawAPI.getAppState();

      // Don't hijack the sticks while the user is mid-draw. During a
      // multi-point line/arrow the element is technically "selected", but the
      // user still needs the right stick to move the virtual mouse and place
      // the next point.
      if (
        appState.newElement || // drag-drawing an element
        appState.multiElement || // multi-point line/arrow being drawn
        appState.editingLinearElement // editing an existing linear element
      ) {
        return null;
      }

      const selectedElementIds = appState.selectedElementIds || {};
      const ids = Object.keys(selectedElementIds).filter(
        (id) => selectedElementIds[id],
      );
      if (ids.length !== 1) return null;

      const element = excalidrawAPI
        .getSceneElements()
        .find((el) => el.id === ids[0]);

      if (!element || element.isDeleted) return null;
      if (!ENDPOINT_EDITABLE_TYPES.includes(element.type)) return null;

      return element;
    };

    // Returns a *new* element with one endpoint moved by (dx, dy) scene units.
    //   "start" -> first point of a line/arrow  |  top-left of a rectangle
    //   "end"   -> last point of a line/arrow   |  bottom-right of a rectangle
    const withMovedEndpoint = (element, endpoint, dx, dy) => {
      if (dx === 0 && dy === 0) return null;

      const base = {
        version: element.version + 1,
        versionNonce: Math.floor(Math.random() * 1e9),
        updated: Date.now(),
      };

      if (element.type === "line" || element.type === "arrow") {
        const points = element.points;
        if (!points || points.length < 2) return null;

        const index = endpoint === "start" ? 0 : points.length - 1;

        // 1) Compute the absolute scene position of every point after the move.
        //    Only the targeted point (start or end) is translated; all other
        //    points keep their original absolute position.
        const absPoints = points.map((p, i) => [
          element.x + p[0] + (i === index ? dx : 0),
          element.y + p[1] + (i === index ? dy : 0),
        ]);

        // 2) Re-normalise so points[0] === [0, 0]. Excalidraw's linear elements
        //    rely on this invariant — if it's violated the element gets dropped
        //    from the scene, which is why the line/arrow seemed to disappear.
        const newX = absPoints[0][0];
        const newY = absPoints[0][1];
        const newPoints = absPoints.map(([px, py]) => [px - newX, py - newY]);

        const xs = newPoints.map((p) => p[0]);
        const ys = newPoints.map((p) => p[1]);

        return {
          ...element,
          ...base,
          x: newX,
          y: newY,
          points: newPoints,
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      }

      // ---- rectangle ----
      if (endpoint === "start") {
        // Clamp so the corner can never cross the opposite one.
        const appliedDx = Math.min(dx, element.width - MIN_ELEMENT_SIZE);
        const appliedDy = Math.min(dy, element.height - MIN_ELEMENT_SIZE);

        return {
          ...element,
          ...base,
          x: element.x + appliedDx,
          y: element.y + appliedDy,
          width: element.width - appliedDx,
          height: element.height - appliedDy,
        };
      }

      return {
        ...element,
        ...base,
        width: Math.max(MIN_ELEMENT_SIZE, element.width + dx),
        height: Math.max(MIN_ELEMENT_SIZE, element.height + dy),
      };
    };

    const applyElementUpdate = (nextElement) => {
      if (!excalidrawAPI || !nextElement) return;
      const elements = excalidrawAPI.getSceneElements();
      excalidrawAPI.updateScene({
        elements: elements.map((el) =>
          el.id === nextElement.id ? nextElement : el,
        ),
        captureUpdate:
          CaptureUpdateAction.EVENTUALLY || CaptureUpdateAction.NEVER,
      });
    };

    const deselectAllElements = () => {
      if (!excalidrawAPI) return;
      excalidrawAPI.updateScene({
        appState: { selectedElementIds: {} },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    };

    /* ------------------------------------------------------------------ */

    const handleKeyDown = (e) => {
      const isTyping =
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable;

      if (!isTyping) {
        if (e.key === ",") selectDirection("left");
        else if (e.key === ".") selectDirection("right");
        else if (e.key === ";") selectDirection("up");
        else if (e.key === "'") selectDirection("down");
        else if (e.key === "/" || (e.ctrlKey && e.key === "w"))
          selectDirection("slide_down");
        else if (e.key === "[") toggleLockAllElements(true);
        else if (e.key === "]") toggleLockAllElements(false);
        else if (e.ctrlKey && e.key === "j") openTagWindow();
        else if (e.ctrlKey && e.key === "n") autoSet("down");
        else if (e.ctrlKey && e.key === "m") autoSet("right");
      }
    };

    const triggerRumble = async (
      gp,
      durationMs = 200,
      strongMagnitude = 0.5,
      weakMagnitude = 0.5,
    ) => {
      if (gp && gp.vibrationActuator) {
        try {
          await gp.vibrationActuator.playEffect("dual-rumble", {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: weakMagnitude,
            strongMagnitude: strongMagnitude,
          });
        } catch (err) {
          console.warn("Vibration not supported or failed:", err);
        }
      }
    };

    const checkExistingGamepads = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (gp) {
          activeGamepadIndex = gp.index;
          previousButtonStates = new Array(gp.buttons.length).fill(0);
          previousAxisStates = new Array(gp.axes.length).fill(0);
          if (cursorEl) cursorEl.style.display = "block";
          triggerRumble(gp, 400, 1.0, 0.8);
          excalidrawAPI?.setToast({
            message: "Gamepad Connected!",
            closable: true,
            duration: 2000,
          });
          break;
        }
      }
    };

    const handleGamepadConnected = (e) => {
      activeGamepadIndex = e.gamepad.index;
      previousButtonStates = new Array(e.gamepad.buttons.length).fill(0);
      previousAxisStates = new Array(e.gamepad.axes.length).fill(0);
      if (cursorEl) cursorEl.style.display = "block";
      triggerRumble(e.gamepad, 400, 1.0, 0.8);
      excalidrawAPI?.setToast({
        message: "Gamepad Connected!",
        closable: true,
        duration: 2000,
      });
    };

    const handleGamepadDisconnected = (e) => {
      if (e.gamepad.index === activeGamepadIndex) {
        activeGamepadIndex = null;
        previousButtonStates = [];
        previousAxisStates = [];
        if (cursorEl) cursorEl.style.display = "none";
        excalidrawAPI?.setToast({
          message: "Gamepad Disonnected!",
          closable: true,
          duration: 2000,
        });
      }
    };

    function triggerUndo() {
      const excalidrawContainer = document.querySelector(".excalidraw");
      if (!excalidrawContainer) return;

      const isMac = navigator.platform.includes("Mac");
      const event = new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      excalidrawContainer.dispatchEvent(event);
    }

    function triggerRedo() {
      const excalidrawContainer = document.querySelector(".excalidraw");
      if (!excalidrawContainer) return;

      const isMac = navigator.platform.includes("Mac");
      const event = new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        ctrlKey: !isMac,
        metaKey: isMac,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        view: window,
      });
      excalidrawContainer.dispatchEvent(event);
    }

    const selectTool = (type) => {
      if (!excalidrawAPI) return;
      const current = excalidrawAPI.getAppState().activeTool?.type;

      // Toggle behaviour: pressing the active tool returns to selection,
      // matching Excalidraw's keyboard shortcut behaviour (press "r" twice).
      const next =
        current === type && type !== "selection" ? "selection" : type;

      excalidrawAPI.setActiveTool({ type: next });
    };

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads();
      if (activeGamepadIndex !== null && gamepads[activeGamepadIndex]) {
        const gp = gamepads[activeGamepadIndex];

        // Is a single line / arrow / rectangle selected right now?
        let endpointTarget = getEndpointEditTarget();

        gp?.buttons.forEach((button, index) => {
          const isTrigger = index === 6 || index === 7;
          if (isTrigger) {
            let val = button.value < TRIGGER_DEADZONE ? 0 : button.value;
            if (Math.abs(val - previousButtonStates[index]) > 0.02) {
              previousButtonStates[index] = val;
            }
          } else {
            const isPressed = button.pressed;

            if (isPressed !== previousButtonStates[index] > 0) {
              // While a line / rectangle is selected, any face button
              // (A / B / X / Y) simply deselects it and hands the sticks
              // back to panning / virtual-mouse duty.
              if (isPressed && endpointTarget && index <= 3) {
                deselectAllElements();
                endpointTarget = null;
              } else {
                switch (index) {
                  case 0: // A
                    if (isPressed) autoSet("down");
                    break;
                  case 1: // B
                    if (isPressed) autoSet("right");
                    break;
                  case 2: // X
                    if (isPressed) selectTool("rectangle");
                    break;
                  case 3: // Y
                    if (isPressed) selectTool("line");
                    break;
                  case 4: // lb
                    if (isPressed) {
                      leftMouseClick = true;
                      dispatchPointerEvent("pointerdown", 0);
                    } else {
                      leftMouseClick = false;
                      dispatchPointerEvent("pointerup", 0);
                      dispatchPointerEvent("click", 0);
                    }
                    break;
                  case 5: // rb
                    if (isPressed) {
                      rightMouseClick = true;
                      dispatchPointerEvent("pointerdown", 2);
                    } else {
                      rightMouseClick = false;
                      dispatchPointerEvent("pointerup", 2);
                      dispatchPointerEvent("contextmenu", 2);
                    }
                    break;
                  case 8: // -
                    if (isPressed) toggleSidebar();
                    break;
                  case 9: // -
                    if (isPressed) saveFile();
                    break;
                  case 10: // L3
                    if (isPressed) triggerUndo();
                    break;
                  case 11: // R3
                    if (isPressed) triggerRedo();
                    break;
                  case 12: // D-pad up
                    if (isPressed) MOUSE_SPEED = 10;
                    else MOUSE_SPEED = 2;
                    break;
                  case 13: // D-pad down
                    if (isPressed) selectDirection("slide_down");
                    break;
                  case 14: // D-pad Left
                    if (isPressed) {
                      setPinned((prev) => {
                        const next = !prev;
                        toggleLockOnAllExceptFreedrawElements(next);
                        return next;
                      });
                    }
                    break;
                  case 15: // D-pad Right
                    if (isPressed) selectDirection("right");
                    break;
                  case 16:
                    if (isPressed) {
                      triggerRumble(gp, 200, 0.75, 0.5);

                      excalidrawAPI?.setToast({
                        message: "If you want to shine like a sun, first burn like a sun!",
                        closable: true,
                        duration: 1500,
                      });
                    }
                    break;
                }
              }
            }
            previousButtonStates[index] = isPressed ? 1 : 0;
          }
        });

        // --- Sticks -------------------------------------------------------
        const rightStickX =
          Math.abs(gp?.axes[2]) < AXIS_DEADZONE ? 0 : gp?.axes[2];
        const rightStickY =
          Math.abs(gp?.axes[3]) < AXIS_DEADZONE ? 0 : gp?.axes[3];

        const leftStickX =
          Math.abs(gp?.axes[0]) < AXIS_DEADZONE ? 0 : gp?.axes[0];
        const leftStickY =
          Math.abs(gp?.axes[1]) < AXIS_DEADZONE ? 0 : gp?.axes[1];

        // Endpoint editing takes over the sticks while a line / rectangle is
        // selected — unless LB is held (that keeps the "drag selection" and
        // virtual-mouse behaviour available as an escape hatch).
        const endpointEditMode = !!endpointTarget && !leftMouseClick;

        if (endpointEditMode !== endpointEditActive) {
          endpointEditActive = endpointEditMode;
          if (endpointEditMode && excalidrawAPI) {
            excalidrawAPI.setToast({
              message:
                "Endpoint mode — L-stick: start / top-left, R-stick: end / bottom-right. Any face button deselects.",
              closable: true,
              duration: 2500,
            });
          }
        }

        if (endpointEditMode) {
          // const zoom = excalidrawAPI.getAppState().zoom?.value || 1;
          const step = MOUSE_SPEED;
          let next = endpointTarget;

          // Left stick  -> start point (line) / top-left corner (rect)
          if (leftStickX !== 0 || leftStickY !== 0) {
            next =
              withMovedEndpoint(
                next,
                "start",
                leftStickX * step,
                leftStickY * step,
              ) || next;
          }

          // Right stick -> end point (line) / bottom-right corner (rect)
          if (rightStickX !== 0 || rightStickY !== 0) {
            next =
              withMovedEndpoint(
                next,
                "end",
                rightStickX * step,
                rightStickY * step,
              ) || next;
          }

          if (next !== endpointTarget) {
            applyElementUpdate(next);
          }
        } else {
          // --- Right Joystick (Axes 2 & 3) for Virtual Mouse Movement ---
          if (rightStickX !== 0 || rightStickY !== 0) {
            virtualMouseX = Math.max(
              0,
              Math.min(
                window.innerWidth,
                virtualMouseX + rightStickX * MOUSE_SPEED,
              ),
            );
            virtualMouseY = Math.max(
              0,
              Math.min(
                window.innerHeight,
                virtualMouseY + rightStickY * MOUSE_SPEED,
              ),
            );

            if (cursorEl) {
              cursorEl.style.left = `${virtualMouseX}px`;
              cursorEl.style.top = `${virtualMouseY}px`;
            }

            dispatchPointerEvent("pointermove", 0);
          }
        }

        // LT and RT Zoom (anchored on the virtual cursor)
        const ltVal = gp.buttons[6]
          ? gp.buttons[6].value < TRIGGER_DEADZONE
            ? 0
            : gp.buttons[6].value
          : 0;
        const rtVal = gp.buttons[7]
          ? gp.buttons[7].value < TRIGGER_DEADZONE
            ? 0
            : gp.buttons[7].value
          : 0;

        if ((ltVal > 0 || rtVal > 0) && excalidrawAPI) {
          const appState = excalidrawAPI.getAppState();
          const { scrollX, scrollY, zoom } = appState;
          const offsetLeft = appState.offsetLeft ?? 0;
          const offsetTop = appState.offsetTop ?? 0;

          const oldZoom = zoom.value;
          const zoomSpeed = 0.02;
          const newZoom = Math.max(
            0.1,
            Math.min(20, oldZoom + (rtVal - ltVal) * zoomSpeed),
          );

          if (newZoom !== oldZoom) {
            // 1. Convert the virtual cursor from window coords -> canvas coords
            const canvasX = virtualMouseX - offsetLeft;
            const canvasY = virtualMouseY - offsetTop;

            // 2. Scene point that is currently under the cursor
            const sceneX = canvasX / oldZoom - scrollX;
            const sceneY = canvasY / oldZoom - scrollY;

            // 3. New scroll so that the same scene point stays under the cursor
            const newScrollX = canvasX / newZoom - sceneX;
            const newScrollY = canvasY / newZoom - sceneY;

            excalidrawAPI.updateScene({
              appState: {
                zoom: { value: newZoom },
                scrollX: newScrollX,
                scrollY: newScrollY,
              },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }

        // Left Stick Panning (skipped while editing endpoints)
        if (
          !endpointEditMode &&
          (leftStickX !== 0 || leftStickY !== 0) &&
          excalidrawAPI
        ) {
          const currentAppState = excalidrawAPI.getAppState();
          const zoomValue = currentAppState.zoom.value;
          const panSpeed = 15 / zoomValue;

          // Scene-space delta the viewport will move by this frame
          const scrollDeltaX = -leftStickX * panSpeed;
          const scrollDeltaY = -leftStickY * panSpeed;

          const selectedElementIds = currentAppState.selectedElementIds || {};
          const hasSelection = Object.keys(selectedElementIds).length > 0;

          if (leftMouseClick && hasSelection) {
            // Counter-translate selected elements so they stay pinned on screen.
            // screen = (scene + scroll) * zoom  →  keep screen const while scroll
            // changes by Δs  →  scene must change by -Δs.
            const elements = excalidrawAPI.getSceneElements();

            const newElements = elements.map((el) =>
              selectedElementIds[el.id]
                ? {
                    ...el,
                    x: el.x - scrollDeltaX,
                    y: el.y - scrollDeltaY,
                  }
                : el,
            );

            excalidrawAPI.updateScene({
              elements: newElements,
              appState: {
                ...currentAppState,
                scrollX: currentAppState.scrollX + scrollDeltaX,
                scrollY: currentAppState.scrollY + scrollDeltaY,
              },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          } else {
            // Normal panning (no selection, or RB not held)
            excalidrawAPI.updateScene({
              appState: {
                ...currentAppState,
                scrollX: currentAppState.scrollX + scrollDeltaX,
                scrollY: currentAppState.scrollY + scrollDeltaY,
              },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      }
      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);

    checkExistingGamepads();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener(
        "gamepaddisconnected",
        handleGamepadDisconnected,
      );
      if (cursorEl) cursorEl.remove();
      cancelAnimationFrame(animationFrameId);
    };
  }, [excalidrawAPI]);

  return (
    <>
      <Excalidraw
        onExcalidrawAPI={(api) => {
          api?.onEvent("editor:mount", async ({ excalidrawAPI, container }) => {
            setExcalidrawAPI(excalidrawAPI);
            await run(excalidrawAPI);
          });
        }}
        initialData={initialData}
        theme="light"
        onPointerUp={(_, __) => {
          if (saved) {
            setSaved(false);
          }
        }}
        validateEmbeddable={(link) => false}
        renderTopRightUI={() => {
          return (
            <Button
              className="p-4 bg-[#28292c]! border! border-[#191919]!"
              variant="outline"
              onClick={saveFile}
            >
              <Save size={4} />
            </Button>
          );
        }}
      >
        <MainMenu>
          <MainMenu.Item icon={<Save strokeWidth={1.5} />} onSelect={saveFile}>
            Save
          </MainMenu.Item>
          <MainMenu.Item
            icon={<SidebarIcon strokeWidth={1.5} />}
            onSelect={toggleSidebar}
            shortcut="b"
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
          {!import.meta.env.VITE_ANDROID_BUILD ? (
            <MainMenu.Item
              icon={<FolderSync strokeWidth={1.5} />}
              onSelect={async () => {
                const check = await checkHealth();
                if (check.success) {
                  if (socket.connected) {
                    socket.emit("join-room", activeFolder);
                    toast.success("Already connected to server.");
                  } else {
                    socket.connect();
                    socket.once("connect", () => {
                      socket.emit("join-room", activeFolder);
                      toast.success("Socket Connected!...");
                    });
                  }
                } else {
                  toast.error("Failed to connect Socket!...");
                }
              }}
            >
              Connect Sync
            </MainMenu.Item>
          ) : (
            <></>
          )}
          <MainMenu.Item
            icon={<LockKeyhole strokeWidth={1.5} />}
            onSelect={() => toggleLockAllElements(true)}
            shortcut="["
          >
            Lock All Elements
          </MainMenu.Item>
          <MainMenu.Item
            icon={<LockKeyholeOpen strokeWidth={1.5} />}
            onSelect={() => toggleLockAllElements(false)}
            shortcut="]"
          >
            Unlock All Elements
          </MainMenu.Item>
          {!import.meta.env.VITE_ANDROID_BUILD ? (
            <>
              <MainMenu.Separator />
              <MainMenu.DefaultItems.LoadScene />
              <MainMenu.DefaultItems.Export />
              <MainMenu.DefaultItems.SaveAsImage />
            </>
          ) : (
            <></>
          )}
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Preferences />
          {/* <MainMenu.DefaultItems.ToggleTheme /> */}
          <MainMenu.Item
            icon={<Bandage strokeWidth={1.5} />}
            onSelect={() => {
              setLegacyImportSize((c) => !c);
            }}
          >
            {`Legacy Import Size ${legacyImportSize ? "On" : "Off"}`}
          </MainMenu.Item>
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <Sidebar name="tag" className="bg-[#111]! w-[400px]!">
          <Sidebar.Header>{tabHeader}</Sidebar.Header>
          <Sidebar.Tabs className="no-scrollbar overflow-y-scroll">
            <Sidebar.Tab tab="tag-manager">
              <TagManager
                selectedElementId={selectedElementId}
                activeFolder={activeFolder}
                savePath={savePath}
              />
            </Sidebar.Tab>
            <Sidebar.Tab tab="tag-viewer">
              <TagViewer activeFolder={activeFolder} savePath={savePath} />
            </Sidebar.Tab>
          </Sidebar.Tabs>
        </Sidebar>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>vortex</WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>
              Organize Your World
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItem
                icon={<SidebarIcon strokeWidth={1.5} className="size-4" />}
                onSelect={toggleSidebar}
                shortcut="b"
              >
                Toggle Sidebar
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<PanelRight strokeWidth={1.5} className="size-4" />}
                onSelect={toggleRightSidebar}
                shortcut="u"
              >
                Toggle Right Sidebar
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<Images className="size-4" strokeWidth={1.5} />}
                onSelect={() => imagesOpenRef.current.click()}
              >
                Insert Images
              </WelcomeScreen.Center.MenuItem>
              <WelcomeScreen.Center.MenuItem
                icon={<FileText className="size-4" strokeWidth={1.5} />}
                onSelect={() => {
                  setPdfOpen(true);
                }}
              >
                Import PDF
              </WelcomeScreen.Center.MenuItem>
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
        <Footer>
          <div className="ml-2 w-full flex justify-between">
            <div className="flex gap-2">
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={toggleSidebar}
              >
                <SidebarIcon className="size-4" />
              </Button>

              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => autoSet("right")}
              >
                <ChevronsRight className="size-4" />
              </Button>

              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => autoSet("down")}
              >
                <ChevronsDown className="size-4" />
              </Button>

              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => toggleLockOnAllExceptFreedrawElements(true)}
              >
                <Pin className="size-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => toggleLockOnAllExceptFreedrawElements(false)}
              >
                <PinOff className="size-4" />
              </Button>

              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={openTagWindow}
              >
                <Tag className="size-4" />
              </Button>
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => selectDirection("left")}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => selectDirection("slide_down")}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={() => selectDirection("right")}
              >
                <ArrowRight className="size-4" />
              </Button>
              <Button
                className="p-4 bg-[#28292c]! border! border-[#191919]!"
                variant="outline"
                onClick={toggleRightSidebar}
              >
                <PanelRight className="size-4" />
              </Button>
            </div>
          </div>
        </Footer>
      </Excalidraw>

      <input
        ref={imagesOpenRef}
        type="file"
        multiple
        onChange={handleImages}
        accept="image/*"
        style={{
          display: "none",
        }}
      />

      <Dialog
        open={pdfOpen}
        onOpenChange={(open) => {
          setPdfOpen(open);
          if (!open) setPdfName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import PDF</DialogTitle>
            <DialogDescription>Select a PDF File</DialogDescription>
          </DialogHeader>
          <form className="space-y-2" onSubmit={handlePDFImport}>
            <Label>Select PDF File</Label>
            <div className="flex">
              <Input
                name="pdfFile"
                type="file"
                id="SelectPDF"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const fileName = file.name.replace(/\.pdf$/i, "");
                  setPdfName(fileName);
                }}
              />
              <CopyButton
                value={pdfName}
                size="size-6"
                className="w-14 flex items-center justify-center"
              />
            </div>
            <Label htmlFor="SegmentPerPage">Segment Par Page</Label>
            <Input
              name="segmentPerPage"
              type="number"
              id="SegmentPerPage"
              defaultValue={1}
              min={0}
            />

            <Button className="mt-2 w-full" variant="outline" type="submit">
              Import
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {loading && (
        <div className="absolute inset-0 z-10">
          <Loader opacity={loadingOpacity} />
        </div>
      )}
    </>
  );
};

import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
  Sidebar,
  mutateElement,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
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
} from "lucide-react";
import { uiStore } from "../lib/store";
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

const getBoundingBox = (el) => ({
  left: el.x,
  right: el.x + el.width,
  top: el.y,
  bottom: el.y + el.height,
});

const isOverlapping = (a, b) => {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
};

const boxDistance = (a, b) => {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);

  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);

  return dx * dx + dy * dy;
};

const initialData = {
  appState: {
    viewBackgroundColor: "#222",
  },
};

export const Editor = ({ saved }) => {
  const imagesOpenRef = useRef(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [tabHeader, setTabHeader] = useState("");
  const [pdfName, setPdfName] = useState("");

  const {
    toggleSidebar,
    toggleRightSidebar,
    setTree,
    activeFolder,
    setActiveFolder,
    savePath,
    autoSave,
    setAutoSave,
    reload,
    setLoading: setLoader,
    scrollElement,
    setScrollElement,
    loadingFolder,
  } = uiStore();

  useEffect(() => {
    if (scrollElement && autoSave) {
      excalidrawAPI.scrollToContent(scrollElement, {
        fitToContent: true,
      });
      setScrollElement(null);
    }
  }, [scrollElement, autoSave]);

  useEffect(() => {
    setLoading(true);
    ids = new Set([]);

    setTimeout(() => {
      setLoading(false);
    }, 10);
  }, [activeFolder, reload]);

  useEffect(() => {
    async function run() {
      if (!loadingFolder && activeFolder && excalidrawAPI) {
        excalidrawAPI.setToast({
          message: `Loading, please wait ...`,
          closable: false,
          duration: Infinity,
        });
        setLoader(true);

        let isActive = false;

        if (!import.meta.env.VITE_ANDROID_BUILD) {
          try {
            const roomRes = await fetch(
              import.meta.env.VITE_API_URL
                ? `${import.meta.env.VITE_API_URL}/is-room-active`
                : "http://localhost:5000/is-room-active",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  activeFolder: activeFolder,
                }),
              },
            );

            const { active } = await roomRes.json();
            isActive = active;
          } catch (e) {
            console.log(e);
          }
        }

        const data = await window.api.openFile({
          activeFolder,
          savePath,
          isActive, // used to programatically delete unwanted files...
        });

        if (data.success) {
          ids = new Set(data.idList);

          const currentState = excalidrawAPI.getAppState();
          excalidrawAPI.updateScene({
            elements: data.elements,
            appState: data.appState,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });

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
              const chunk = data.idList.slice(i, i + batchSize);

              const files = await window.api.getImage({
                activeFolder,
                savePath,
                isActive,
                idList: chunk, // Sending the array of 10 IDs
              });

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

          setAutoSave(true);
        } else {
          setActiveFolder(null);
        }

        excalidrawAPI.setToast(null);
        saved.current = true;
        setLoader(false);
      }
    }
    run();
  }, [excalidrawAPI, loadingFolder]);

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

  const handleSave = async (elements, appState, files) => {
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
    };

    const data = await window.api.handleSave({
      activeFolder,
      elements,
      fileList: import.meta.env.VITE_ANDROID_BUILD ? [] : newlyAddedFiles,
      appState: appStateToSave,
      savePath,
    });

    if (data.success) {
      if (import.meta.env.VITE_ANDROID_BUILD && newlyAddedFiles.length > 0) {
        excalidrawAPI.setToast({
          message: `Saving images, please wait ...`,
          closable: false,
          duration: Infinity,
        });

        for (let i = 0; i < newlyAddedFiles.length; i += batchSize) {
          const chunk = newlyAddedFiles.slice(i, i + batchSize);

          const res = await window.api.saveImage({
            activeFolder: data.activeFolder,
            fileList: chunk, // Sending the batch of 10
          });

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
        setActiveFolder(data.activeFolder);
        const data2 = await window.api.getFiles(savePath);
        if (data2.success) {
          setTree(data2.tree);
        }
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

      toast.dismiss(tid);
      toast.success("Save Successfull!..");
      saved.current = true;
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
    setAutoSave(true);
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
        if (d === "down") {
          mutateElement(selectedElement, {
            x: nearestElement.x,
            y: nearestElement.y + nearestElement.height + 5,
            width: nearestElement.width,
            height:
              (nearestElement.width / selectedElement.width) *
              selectedElement.height,
          });
        } else if (d === "right") {
          mutateElement(selectedElement, {
            x: nearestElement.x + nearestElement.width + 100,
            y: nearestElement.y,
            width: nearestElement.width,
            height:
              (nearestElement.width / selectedElement.width) *
              selectedElement.height,
          });
        }
      }
    }
  };

  const insertImage = async (file, x, y, gap) => {
    const options = {
      maxSizeMB: 1,
      useWebWorker: true,
    };

    file = await imageCompression(file, options);

    const fileUrl = URL.createObjectURL(file);

    let { width, height } = await getImageDimensions(fileUrl);
    URL.revokeObjectURL(fileUrl);

    const base64 = await fileToBase64(file);

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

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), imageElement],
    });
    excalidrawAPI.addFiles([
      {
        id: imageId,
        mimeType: file.type,
        dataURL: base64,
        created: Date.now(),
        lastRetrieved: Date.now(),
      },
    ]);

    return height;
  };

  const insertImages = async (files, gap = 20) => {
    excalidrawAPI.setToast({
      message: `Inserting Images ...`,
      closable: false,
      duration: Infinity,
    });
    setLoader(true);

    let x = 0;
    let y = 0;
    let i = 1;
    for (const file of files) {
      const height = await insertImage(file, x, y, gap);
      y += height + gap;

      excalidrawAPI.setToast({
        message: `Image ${i++}/${files.length} inserted successfully!`,
        closable: false,
        duration: Infinity,
      });
    }

    setLoader(false);
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

    setLoader(true);

    let x = 0;
    let y = 0;

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

        const chunkHeight =
          numSegments === 0 ? 1130.65 : totalHeight / numSegments;

        if (numSegments === 0)
          numSegments = Math.ceil(totalHeight / chunkHeight);

        for (let i = 0; i < numSegments; i++) {
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

          const imageFile = await getCanvasBlob(segmentCanvas, "image/jpeg");
          const imageHeight = await insertImage(imageFile, x, y, 0);
          y += imageHeight;

          // MEMORY FIX 1: Immediately free canvas graphics memory
          segmentCanvas.width = 0;
          segmentCanvas.height = 0;

          excalidrawAPI.setToast({
            message: `PDF loading ${i + 1}/${numSegments} ${pageNum}/${numPages} pages.`,
            closable: true,
            duration: 2000,
          });
        }

        page.cleanup(); // MEMORY FIX 2: Free PDF.js page memory

        // MEMORY FIX 3: Yield to the Garbage Collector so memory doesn't spike
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      excalidrawAPI.setToast({
        message: `PDF loaded! ${numPages} pages.`,
        closable: true,
        duration: 2000,
      });
      setLoader(false);
    } catch (error) {
      setLoader(false);
      console.error("Error loading PDF:", error);
      excalidrawAPI.setToast({
        message: "Failed to load PDF.",
        closable: true,
        duration: 2000,
      });
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
    const handler = (e) => {
      const isTyping =
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable;

      if (!isTyping) {
        if (e.key === ",") {
          selectDirection("left");
        } else if (e.key === ".") {
          selectDirection("right");
        } else if (e.key === ";") {
          selectDirection("up");
        } else if (e.key === "'") {
          selectDirection("down");
        } else if (e.key === "/" || e.key === "w") {
          selectDirection("slide_down");
        } else if (e.key === "[") {
          toggleLockAllElements(true);
        } else if (e.key === "]") {
          toggleLockAllElements(false);
        } else if (e.key === "b") {
          toggleSidebar();
        } else if (e.key === "u") {
          toggleRightSidebar();
        } else if (e.key === "j") {
          openTagWindow();
        } else if (e.key === "s") {
          saveFile();
        } else if (e.key === "n") {
          autoSet("down");
        } else if (e.key === "m") {
          autoSet("right");
        }
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
        onChange={() => {
          if (saved.current) {
            saved.current = false;
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
              <ArrowLeftToLine size={4} />
            </Button>
          );
        }}
      >
        <MainMenu>
          <MainMenu.Item
            icon={<ArrowLeftToLine strokeWidth={1.5} />}
            onSelect={saveFile}
            shortcut="s"
          >
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
    </>
  );
};

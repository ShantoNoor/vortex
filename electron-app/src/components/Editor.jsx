import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  Footer,
  Sidebar,
  mutateElement,
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
import { CopyButton } from "./CopyButton";
import TagManager from "./TagManager";
import TagViewer from "./TagViewer";
import { checkHealth, socket } from "../lib/socket";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
pdfjsLib.GlobalWorkerOptions.enableWebGL = true;
const chunkWidth = 2000;

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
  appState: { viewBackgroundColor: "#222" },
};

export const Editor = ({ saved }) => {
  const timeoutId = useRef(null);
  const imagesOpenRef = useRef(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [tabHeader, setTabHeader] = useState("");

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

        try {
          if (!import.meta.env.VITE_ANDROID_BUILD) {
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
          }
        } catch (e) {}

        const data = await window.api.openFile({
          activeFolder,
          savePath,
          isActive, // used to programatically delete unwanted files...
        });

        if (data.success) {
          ids = new Set(data.idList);

          excalidrawAPI.updateScene({
            elements: data.elements,
            appState: {
              ...data.appState,
              activeTool: {
                type: "hand",
              },
            },
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          setLoader(false);

          if (!import.meta.env.VITE_ANDROID_BUILD) {
            excalidrawAPI.addFiles(data.files);
          } else {
            excalidrawAPI.setToast({
              message: "Adding images ...",
              closable: false,
              duration: Infinity,
            });

            for (let i = 0; i < data.idList.length; ++i) {
              const fileId = data.idList[i];
              const file = await window.api.getImage({
                activeFolder,
                savePath,
                isActive,
                fileId,
              });

              excalidrawAPI.addFiles(file);

              excalidrawAPI.setToast({
                message: `Loading ${i + 1}/${data.idList.length} images...`,
                closable: true,
                duration: 1000,
              });
            }
          }

          setAutoSave(true);
          if (!import.meta.env.VITE_ANDROID_BUILD)
            socket.emit("join-room", activeFolder);
        } else {
          setActiveFolder(null);
          setLoader(false);
        }

        excalidrawAPI.setToast(null);
        saved.current = true;
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

        let j = 1;
        for (let i = 0; i < newlyAddedFiles.length; ++i) {
          const file = newlyAddedFiles[i];
          const res = await window.api.saveImage({
            activeFolder: data.activeFolder,
            fileList: [file],
          });

          excalidrawAPI.setToast({
            message: `Saved ${j++}/${newlyAddedFiles.length} images.`,
            closable: true,
            duration: 1000,
          });

          ids.add(file.id);
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
    const base64 = await fileToBase64(file);

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
        message: `Image ${i++} inserted successfully!`,
        closable: true,
        duration: 2000,
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

    insertImages(files);
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

          excalidrawAPI.setToast({
            message: `PDF loading ${i + 1}/${numSegments} ${pageNum}/${numPages} pages.`,
            closable: true,
            duration: 1000,
          });
        }
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
        // onChange={(elements, appState, files) => {
        //   if (activeFolder && autoSave && !import.meta.env.VITE_API_URL) {
        //     if (timeoutId.current) {
        //       clearTimeout(timeoutId.current);
        //     }
        //     timeoutId.current = setTimeout(() => {
        //       handleSave(elements, appState, files);
        //     }, 500);
        //   }
        // }}
        onChange={() => {
          if (saved.current) {
            saved.current = false;
          }
        }}
        validateEmbeddable={(link) => true}
        renderEmbeddable={(element, appState) => {
          if (element.link.endsWith(".pdf")) {
            return (
              <webview
                className="w-full h-full"
                src={`${element.link}#view=FitH`}
              ></webview>
            );
          }

          if (element.link.endsWith(".mp4")) {
            return (
              <webview className="w-full h-full" src={element.link}></webview>
            );
          }

          if (
            element.link.startsWith("https://youtu.be/") &&
            import.meta.env.VITE_API_URL
          )
            return (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${element.link.split("/").at(-1)}`}
              ></iframe>
            );
        }}
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
            onClick={saveFile}
          >
            Save
          </MainMenu.Item>
          <MainMenu.Item
            icon={<SidebarIcon strokeWidth={1.5} />}
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
            onClick={() => toggleLockAllElements(true)}
          >
            Lock All Elements
          </MainMenu.Item>
          <MainMenu.Item
            icon={<LockKeyholeOpen strokeWidth={1.5} />}
            onClick={() => toggleLockAllElements(false)}
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

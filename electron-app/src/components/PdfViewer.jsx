import { PDFViewer, ZoomMode } from "@embedpdf/react-pdf-viewer";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  isGroupItem,
} from "../lib/utils";
import { Loader } from "./Loader";
import { uiStore } from "../lib/store";
import { toast } from "sonner";
import {
  Hand,
  Highlighter,
  PanelRight,
  PencilLine,
  Sidebar,
} from "lucide-react";

export default function PdfViewer({ pdfPath }) {
  const viewerRef = useRef(null);
  const [docId, setDocId] = useState(null);

  const { setActiveFolder, toggleSidebar, toggleRightSidebar, setSaved } =
    uiStore();

  const [isPanMode, setIsPanMode] = useState(false);
  const [activeTool, setActiveTool] = useState(null);

  const [pdfName, setPdfName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOpacity, setLoadingOpacity] = useState("1");

  const openPdfFile = async () => {
    const data = await window.api.openPdf(pdfPath);

    if (data.success) {
      const buffer = base64ToArrayBuffer(data.pdfBase64);
      const registry = await viewerRef.current?.registry;
      const docManager = registry.getPlugin("document-manager").provides();
      docManager.openDocumentBuffer({
        buffer: buffer,
        name: data.pdfName,
        autoActivate: true,
      });
      setPdfName(data.pdfName);
      setSaved(true);

      setTimeout(() => {
        setLoading(false);
      }, 500);
    } else {
      setActiveFolder(null, "new");
      toast.error(`Failed to open Pdf: ${data?.error}`);
    }
  };

  const handleSaveToServer = async () => {
    const registry = await viewerRef.current?.registry;
    const exportPlugin = registry.getPlugin("export").provides();

    if (!exportPlugin) return;

    const tid = toast.loading("Saving pdf File ...");

    const arrayBuffer = await exportPlugin.saveAsCopy().toPromise();
    const data = await window.api.savePdf({
      pdfBase64: await arrayBufferToBase64(arrayBuffer),
      pdfPath,
      pdfName,
    });

    toast.dismiss(tid);
    if (data.success) {
      toast.success("Pdf saved successfully ...");
      setSaved(true);
    } else {
      toast.error("Unable to save pdf ... " + data?.error);
    }
  };

  const setupUi = useCallback(async () => {
    const container = viewerRef.current?.container;
    if (!container) return;

    const registry = await container.registry;

    const commands = registry.getPlugin("commands")?.provides();
    const ui = registry.getPlugin("ui")?.provides();

    if (!commands || !ui) return;

    commands.registerCommand({
      id: "custom.save",
      label: "Save",
      icon: "save",
      action: handleSaveToServer,
    });

    commands.registerCommand({
      id: "right.side.bar",
      label: "Show Sidebar",
      icon: "sidebar",
      action: toggleSidebar,
    });

    const currentSchema = ui.getSchema();
    const mainToolbar = currentSchema.toolbars["main-toolbar"];

    if (mainToolbar) {
      const items = structuredClone(mainToolbar.items);

      const leftGroup = items.find(
        (item) => isGroupItem(item) && item.id === "left-group",
      );

      if (leftGroup) {
        const [, , ...rest] = leftGroup.items;
        leftGroup.items = rest;
      }

      const rightGroup = items.find(
        (item) => isGroupItem(item) && item.id === "right-group",
      );

      if (rightGroup) {
        rightGroup.items.pop();
        rightGroup.items.push({
          type: "divider",
          id: "divider-save",
          orientation: "vertical",
        });
        rightGroup.items.push({
          type: "command-button",
          id: "custom-save",
          commandId: "custom.save",
          variant: "icon",
        });
      }

      ui.mergeSchema({
        toolbars: {
          "main-toolbar": {
            ...mainToolbar,
            items,
          },
        },
      });
    }
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let cleanupTool;
    let cleanupEvents;
    let cleanup;

    const setupListeners = async () => {
      const registry = await viewer.registry;

      const documentManager = registry
        .getPlugin("document-manager")
        ?.provides();
      const document = documentManager?.getActiveDocument();
      if (document) {
        setDocId(document.id);

        const panPlugin = registry?.getPlugin("pan")?.provides();
        const docPan = panPlugin?.forDocument(document.id);

        if (docPan) {
          setIsPanMode(docPan.isPanMode());
          cleanup = docPan.onPanModeChange((isActive) => {
            setIsPanMode(isActive);
          });
        }
      }

      const annotationPlugin = registry?.getPlugin("annotation")?.provides();
      if (annotationPlugin) {
        cleanupTool = annotationPlugin.onActiveToolChange(({ tool }) => {
          setActiveTool(tool?.id || null);
        });

        cleanupEvents = annotationPlugin.onAnnotationEvent((event) => {
          if (!loading) {
            setSaved(false);
          }
        });
      }
    };
    setupListeners();
    if (import.meta.env.VITE_ANDROID_BUILD) togglePanMode();
    return () => {
      cleanup?.();
      cleanupTool?.();
      cleanupEvents?.();
    };
  }, [loading]);

  const togglePanMode = async () => {
    const registry = await viewerRef.current?.registry;
    const panPlugin = registry?.getPlugin("pan")?.provides();
    panPlugin?.forDocument(docId).togglePan();
  };

  const setTool = async (toolId) => {
    const registry = await viewerRef.current?.registry;
    const annotationPlugin = registry?.getPlugin("annotation")?.provides();
    annotationPlugin?.setActiveTool(toolId);
  };

  return (
    <div className="relative">
      <PDFViewer
        ref={viewerRef}
        config={{
          disabledCategories: ["document", "form"],
          documentManager: {
            initialDocuments: [],
            maxDocuments: 1,
          },
          tabBar: "never",
          zoom: {
            defaultZoomLevel: ZoomMode.FitWidth,
          },
          theme: {
            preference: "dark",
            dark: {
              accent: {
                primary: "#e0dfff",
                hover: "#c0a0e1",
                active: "#af8adc",
                light: "#f5f2ff",
                darkLight: "#0d0b7c",
              },
              background: {
                app: "#222", // The main background behind the document
                surface: "#111", // Toolbars, sidebars, panels
                surfaceAlt: "#111", // Secondary toolbars
                elevated: "#111", // Dropdowns, popups
                overlay: "#111", // Modal backdrops (usually transparent rgba)
                input: "#111", // Text inputs and checkboxes
              },
              border: {
                default: "#222",
              },
            },
          },
        }}
        style={{ width: "100%", height: "100vh" }}
        onReady={(registry) => {
          setupUi();
          openPdfFile();
        }}
      />

      <div className="absolute bottom-6 right-3 md:right-10 z-10 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#222] dark:bg-[#111]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <div
                onClick={togglePanMode}
                className={`rounded p-2 transition-colors ${
                  isPanMode
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-[#e0dfff]"
                    : "text-gray-600 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700"
                }`}
                title="Pan"
              >
                <Hand size={18} />
              </div>
              <div
                onClick={() => setTool("highlight")}
                className={`rounded p-2 transition-colors ${
                  activeTool === "highlight"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-[#e0dfff]"
                    : "text-gray-600 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700"
                }`}
                title="Highlighter"
              >
                <Highlighter size={18} />
              </div>
              <div
                onClick={() => setTool("inkHighlighter")}
                className={`rounded p-2 transition-colors ${
                  activeTool === "inkHighlighter"
                    ? "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-[#e0dfff]"
                    : "text-gray-600 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700"
                }`}
                title="Pen (Ink Highlighter)"
              >
                <PencilLine size={18} />
              </div>
              <div
                onClick={toggleRightSidebar}
                className={`rounded p-2 transition-colors text-gray-600 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700`}
                title="Open Right Sidebar"
              >
                <PanelRight size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-3 md:left-10 z-10 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-[#222] dark:bg-[#111]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div
                onClick={toggleSidebar}
                className={`rounded p-2 transition-colors text-gray-600 hover:bg-gray-200 dark:text-white dark:hover:bg-gray-700`}
                title="Open Sidebar"
              >
                <Sidebar size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-10">
          <Loader opacity={loadingOpacity} />
        </div>
      )}
    </div>
  );
}

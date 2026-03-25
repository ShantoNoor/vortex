import { PDFViewer } from "@embedpdf/react-pdf-viewer";
import { useCallback, useRef, useState } from "react";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  isGroupItem,
} from "../lib/utils";
import { Loader } from "./Loader";
import { uiStore } from "../lib/store";
import { toast } from "sonner";

export default function PdfViewer({ pdfPath }) {
  const viewerRef = useRef(null);

  const { setActiveFolder } = uiStore();

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

    const currentSchema = ui.getSchema();
    const mainToolbar = currentSchema.toolbars["main-toolbar"];

    if (mainToolbar) {
      // Clone items with proper typing using structuredClone
      const items = structuredClone(mainToolbar.items);

      // Find the right-group using type guard
      const rightGroup = items.find(
        (item) => isGroupItem(item) && item.id === "right-group",
      );

      if (rightGroup) {
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
      {loading && (
        <div className="absolute inset-0 z-10">
          <Loader opacity={loadingOpacity} />
        </div>
      )}
    </div>
  );
}

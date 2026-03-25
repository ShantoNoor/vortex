import { useEffect, useState } from "react";
import { uiStore } from "../lib/store";
import { generateUUID } from "../lib/utils";
import { Editor } from "./Editor";
import PdfViewer from "./PdfViewer";

export default function Workspace({ saved }) {
  const { activeFolder, fileTransitionIntent } = uiStore();
  const [sessionKey, setSessionKey] = useState(() => generateUUID());

  useEffect(() => {
    if (fileTransitionIntent === "new" || fileTransitionIntent === "open") {
      setSessionKey(generateUUID());
    }
  }, [activeFolder, fileTransitionIntent]);

  const isPdf = activeFolder?.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return <PdfViewer key={sessionKey} fileId={activeFolder} />;
  }

  return <Editor key={sessionKey} saved={saved} />;
}

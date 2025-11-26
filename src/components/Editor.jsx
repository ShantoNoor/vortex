import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { PanelRightClose } from "lucide-react";
import { useUiStore } from "../lib/store";

const initialData = {
  appState: { viewBackgroundColor: "#222" },
};

export const Editor = () => {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  return (
    <Excalidraw initialData={initialData}>
      <MainMenu>
        <MainMenu.Item icon={<PanelRightClose />} onClick={toggleSidebar}>
          Toggle Sidebar
        </MainMenu.Item>
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
    </Excalidraw>
  );
};

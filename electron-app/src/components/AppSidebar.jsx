import {
  FilePenLine,
  FilePlus,
  FileText,
  FolderPen,
  PanelRight,
  Trash,
} from "lucide-react";
import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree";

import { uiStore } from "../lib/store";

export function AppSidebar() {
  const {
    selectFolder,
    tree,
    savePath,
    setActiveFolder,
    activeFolder,
    toggleRightSidebar,
    recents,
    removeFromRecents,
    saved,
  } = uiStore();

  const actions = [
    {
      name: "New",
      icon: <FilePlus className="min-w-4 min-h-4 " />,
      onClick: () => {
        if (
          !activeFolder &&
          !confirm("Sure then Ok else Cancel and Save! ...")
        ) {
          return;
        }
        setActiveFolder(null, "new");
      },
      show: import.meta.env.VITE_API_URL ? false : true,
    },
    {
      name: "Open Folder",
      icon: <FolderPen className="min-w-4 min-h-4" />,
      onClick: () => {
        if (
          !activeFolder &&
          !confirm("Sure then Ok else Cancel and Save! ...")
        ) {
          return;
        }
        selectFolder();
      },
      show: import.meta.env.VITE_API_URL ? false : true,
    },
    {
      name: "Toggle Right Sidebar",
      icon: <PanelRight className="w-4 h-4" />,
      onClick: toggleRightSidebar,
      show: true,
    },
  ];

  return (
    <aside className="h-dvh flex flex-col bg-background border-r">
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <TreeProvider
          defaultExpandedIds={["action"]}
          selectedIds={[]}
          onSelectionChange={(ids) => {}}
        >
          <TreeView className="p-0 py-1">
            <TreeNode nodeId="action">
              <TreeNodeTrigger>
                <TreeExpander hasChildren />
                <TreeLabel>Action</TreeLabel>
              </TreeNodeTrigger>
              <TreeNodeContent hasChildren>
                {actions
                  .filter((item) => item.show)
                  .map((item) => (
                    <TreeNode nodeId={item.name} key={item.name}>
                      <TreeNodeTrigger onClick={item.onClick}>
                        <TreeExpander />
                        <TreeIcon icon={item.icon} />
                        <TreeLabel>{item.name}</TreeLabel>
                      </TreeNodeTrigger>
                    </TreeNode>
                  ))}
              </TreeNodeContent>
            </TreeNode>
          </TreeView>
        </TreeProvider>

        {recents.length > 0 && (
          <TreeProvider
            defaultExpandedIds={[]}
            selectedIds={[activeFolder]}
            onSelectionChange={(ids) => {}}
          >
            <TreeView className="p-0 py-1">
              <TreeNode nodeId="recents">
                <TreeNodeTrigger>
                  <TreeExpander hasChildren />
                  <TreeLabel>Recents</TreeLabel>
                </TreeNodeTrigger>
                <TreeNodeContent hasChildren>
                  {recents.map((item) => (
                    <TreeNode
                      className="relative"
                      nodeId={item.path}
                      key={item.name}
                    >
                      <TreeNodeTrigger
                        onClick={() => {
                          if (item.path === activeFolder) return;
                          if (
                            !activeFolder &&
                            !confirm("Sure then Ok else Cancel and Save! ...")
                          ) {
                            return;
                          }
                          if (
                            activeFolder &&
                            !saved &&
                            !confirm("Sure then Ok else Cancel and Save! ...")
                          ) {
                            return;
                          }

                          setActiveFolder(item.path, "open");
                        }}
                      >
                        <TreeExpander />
                        <TreeIcon
                          icon={
                            item.isPdf ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <FilePenLine className="h-4 w-4" />
                            )
                          }
                        />
                        <TreeLabel>{item.name}</TreeLabel>

                        {item.path === activeFolder && !saved && (
                          <span className="text-[12px] font-medium flex items-center justify-center h-4 w-4">
                            M
                          </span>
                        )}
                        <Trash
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromRecents(item.path);
                          }}
                          className="flex items-center justify-center size-3 hover:bg-foreground hover:text-background rounded transition-colors"
                        />
                      </TreeNodeTrigger>
                    </TreeNode>
                  ))}
                </TreeNodeContent>
              </TreeNode>
            </TreeView>
          </TreeProvider>
        )}

        {tree && tree.length > 0 && (
          <TreeProvider
            defaultExpandedIds={[
              "src-shanto-loves-coding",
              ...(activeFolder
                ? activeFolder?.replace(savePath, "")?.split("/")
                : []),
            ]}
            selectedIds={[activeFolder]}
            onSelectionChange={(ids) => {}}
          >
            <TreeView className="p-0">
              <TreeNode nodeId="src-shanto-loves-coding">
                <TreeNodeTrigger>
                  <TreeExpander hasChildren />
                  <TreeIcon hasChildren />
                  <TreeLabel>{savePath}</TreeLabel>
                </TreeNodeTrigger>
                <TreeNodeContent hasChildren>
                  {tree.map((item, index) => (
                    <KiboTree
                      key={index}
                      item={item}
                      level={1}
                      isLast={index === tree.length - 1}
                    />
                  ))}
                </TreeNodeContent>
              </TreeNode>
            </TreeView>
          </TreeProvider>
        )}
      </div>
    </aside>
  );
}

function KiboTree({ item, level = 1, isLast }) {
  const [name, ...items] = Array.isArray(item) ? item : [item];
  const { setActiveFolder, activeFolder, saved, addToRecents } = uiStore();

  if (typeof name !== "string") {
    const isPdf = name.name.toLowerCase().endsWith(".pdf");
    const Icon = isPdf ? FileText : FilePenLine;
    const isActive = name.path === activeFolder;

    return (
      <TreeNode level={level} nodeId={name.path} isLast={isLast}>
        <TreeNodeTrigger
          className=""
          onClick={() => {
            if (isActive) return;
            if (
              !activeFolder &&
              !confirm("Sure then Ok else Cancel and Save! ...")
            ) {
              return;
            }
            if (
              activeFolder &&
              !saved &&
              !confirm("Sure then Ok else Cancel and Save! ...")
            ) {
              return;
            }
            addToRecents({
              ...name,
              isPdf,
            });
            setActiveFolder(name.path, "open");
          }}
        >
          <TreeExpander />
          <TreeIcon
            icon={<Icon className={`h-4 w-4 ${isActive ? "" : ""}`} />}
          />
          <TreeLabel className={`truncate ${isActive ? "font-medium" : ""}`}>
            {name.name}
          </TreeLabel>

          {isActive && !saved && (
            <span className="text-[12px] font-medium flex items-center justify-center h-4 w-4">
              M
            </span>
          )}
        </TreeNodeTrigger>
      </TreeNode>
    );
  }

  return (
    <TreeNode level={level} nodeId={name} isLast={isLast}>
      <TreeNodeTrigger>
        <TreeExpander hasChildren />
        <TreeIcon hasChildren />
        <TreeLabel className="truncate">{name}</TreeLabel>
      </TreeNodeTrigger>
      <TreeNodeContent hasChildren>
        {items.map((subItem, index) => (
          <KiboTree
            key={index}
            item={subItem}
            level={level + 1}
            isLast={index === items.length - 1}
          />
        ))}
      </TreeNodeContent>
    </TreeNode>
  );
}

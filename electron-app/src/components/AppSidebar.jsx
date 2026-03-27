import {
  ChevronRight,
  FilePenLine,
  FilePlus,
  FileText,
  FolderPen,
  Notebook,
  PanelRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuBadge,
  SidebarProvider,
} from "@/components/ui/sidebar";

import { uiStore } from "../lib/store";

export function AppSidebar({ saved }) {
  const {
    selectFolder,
    tree,
    savePath,
    setActiveFolder,
    activeFolder,
    toggleRightSidebar,
  } = uiStore();
  const actions = [
    {
      name: "New",
      icon: <FilePlus />,
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
      icon: <FolderPen />,
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
      icon: <PanelRight />,
      onClick: toggleRightSidebar,
      show: true,
    },
  ];

  return (
    <>
      <SidebarProvider>
        <Sidebar collapsible="none" className="w-full h-dvh">
          <SidebarContent className="no-scrollbar">
            <SidebarGroup>
              <SidebarGroupLabel>Actions</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="">
                  {actions
                    .filter((item) => item.show)
                    .map((item, index) => (
                      <SidebarMenuItem key={index} onClick={item.onClick}>
                        <SidebarMenuButton className="truncate">
                          {item.icon}
                          {item.name}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="">
              <SidebarGroupLabel className="truncate">
                {savePath || ""}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="">
                  {tree?.map((item, index) => (
                    <Tree key={index} item={item} saved={saved} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </>
  );
}

function Tree({ item, saved }) {
  const [name, ...items] = Array.isArray(item) ? item : [item];
  const { setActiveFolder, activeFolder } = uiStore();

  if (typeof name !== "string") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={name.path === activeFolder}
          className="truncate data-[active=true]:bg-accent data-[active=true]:text-orange-400 data-[active=true]:hover:text-orange-400 w-full"
          onClick={() => {
            if (name.path === activeFolder) return;
            if (
              !activeFolder &&
              !confirm("Sure then Ok else Cancel and Save! ...")
            ) {
              return;
            }

            if (
              activeFolder &&
              !saved.current &&
              !confirm("Sure then Ok else Cancel and Save! ...")
            ) {
              return;
            }
            setActiveFolder(name.path, "open");
          }}
        >
          {name.name.toLowerCase().endsWith(".pdf") ? (
            <FileText />
          ) : (
            <FilePenLine />
          )}
          {name.name}
        </SidebarMenuButton>
        {name.path === activeFolder && (
          <SidebarMenuBadge className="hover:bg-red-500 border border-red-50">
            A
          </SidebarMenuBadge>
        )}
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        defaultOpen={activeFolder?.includes(name)}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={activeFolder?.includes(name)}
            className="truncate data-[active=true]:text-orange-400 data-[active=true]:hover:text-orange-400! data-[active=true]:bg-transparent! data-[active=true]:hover:bg-accent!"
          >
            <ChevronRight className="transition-transform" />
            <Notebook />
            {name}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((subItem, index) => (
              <Tree key={index} item={subItem} saved={saved} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

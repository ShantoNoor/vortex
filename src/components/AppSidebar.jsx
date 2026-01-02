import {
  ChevronRight,
  FilePenLine,
  FilePlus,
  FolderPen,
  Notebook,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarRail,
  SidebarMenuBadge,
  SidebarProvider,
} from "@/components/ui/sidebar";

import { useUiStore } from "../lib/store";

export function AppSidebar() {
  const { selectFolder, tree, savePath, setActiveFolder, activeFolder } =
    useUiStore();
  const actions = [
    {
      name: "New",
      icon: <FilePlus />,
      onClick: () => {
        if (
          !activeFolder &&
          !confirm("Sure ? Unsaved progress will be lost ...")
        ) {
          return;
        }
        setActiveFolder(null);
      },
    },
    {
      name: "Open Folder",
      icon: <FolderPen />,
      onClick: () => {
        if (
          !activeFolder &&
          !confirm("Sure ? Unsaved progress will be lost ...")
        ) {
          return;
        }
        selectFolder();
      },
    },
  ];

  return (
    <>
      <SidebarProvider>
        <SidebarContent className="overflow-x-hidden h-dvh no-scrollbar">
          <SidebarGroup>
            <SidebarGroupLabel>Actions</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="min-w-screen">
                {actions.map((item, index) => (
                  <SidebarMenuItem key={index} onClick={item.onClick}>
                    <SidebarMenuButton>
                      {item.icon}
                      {item.name}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="">
            <SidebarGroupLabel>{savePath}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="min-w-screen">
                {tree?.map((item, index) => (
                  <Tree key={index} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </SidebarProvider>
    </>
  );
}

function Tree({ item }) {
  const [name, ...items] = Array.isArray(item) ? item : [item];
  const { setActiveFolder, activeFolder, autoSave } = useUiStore();

  if (typeof name !== "string") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={name.path === activeFolder}
          className="data-[active=true]:bg-accent"
          onClick={() => {
            if (name.path === activeFolder) return;
            if (
              !activeFolder &&
              !confirm("Sure ? Unsaved progress will be lost ...")
            ) {
              return;
            }
            setActiveFolder(name.path);
          }}
        >
          <FilePenLine />
          {name.name}
        </SidebarMenuButton>
        {/* {name.path === activeFolder && autoSave && (
          <SidebarMenuBadge>A</SidebarMenuBadge>
        )} */}
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
            className="data-[active=true]:text-orange-400! data-[active=true]:bg-transparent! data-[active=true]:hover:bg-accent!"
          >
            <ChevronRight className="transition-transform" />
            <Notebook />
            {name}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((subItem, index) => (
              <Tree key={index} item={subItem} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

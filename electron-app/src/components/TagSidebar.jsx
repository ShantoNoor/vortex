import { useEffect, useReducer, useState } from "react";
import { uiStore } from "../lib/store";
import { Input } from "./ui/input";
import { FilePenLine, Link, X } from "lucide-react";
import { CopyButton } from "./CopyButton";

const TagSidebar = () => {
  const [tags, setTags] = useState([]);
  const [tagsFiltered, setTagsFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const {
    setActiveFolder,
    activeFolder,
    setScrollElement,
    savePath,
    toggleRightSidebar,
  } = uiStore();
  const [relativeActiveFolder, setRelativeActiveFolder] =
    useState(activeFolder);

  useEffect(() => {
    (async function () {
      if (activeFolder && savePath) {
        const res = await window.api.relativePath(savePath, activeFolder);
        setRelativeActiveFolder(res);
      }
    })();
  }, [activeFolder]);

  useEffect(() => {
    (async function () {
      const data = await window.db.all();
      setTags(data);
      setTagsFiltered(data);
    })();
  }, []);

  useEffect(() => {
    (async function () {
      if (search !== "") {
        const data = await window.db.searchTag(search);
        setTagsFiltered(data);
      } else {
        setTagsFiltered(tags);
      }
    })();
  }, [search]);

  if (!savePath) {
    return (
      <div className="h-full w-full flex justify-center items-center text-3xl">
        First, Open a folder!...
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="h-full w-full flex justify-center items-center text-3xl">
        No tags found!..
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden h-dvh no-scrollbar">
      <div className="sticky top-0 z-10 bg-[#111] w-full">
        <div
          className={`min-h-8 text-lg  px-2 py-1 border flex justify-between items-center`}
        >
          <div className="overflow-x-hidden flex-1 ">
            <div className="min-w-screen flex gap-1 items-center">
              <FilePenLine className="size-5" />
              <p>{relativeActiveFolder}</p>
            </div>
          </div>
          <X
            onClick={toggleRightSidebar}
            className="size-5 hover:bg-[#222] hover:rounded cursor-pointer"
          />
        </div>

        <Input
          placeholder="Search here..."
          value={search}
          type="search"
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-none"
        />
      </div>
      {tagsFiltered.map((t) => (
        <div
          key={t.id}
          className={`min-h-8 text-lg m-0 pl-2 py-1 border rounded-none cursor-pointer hover:border-blue-400 transition-colors flex items-center ${t.activeFolder === relativeActiveFolder ? "bg-[#222]" : ""}`}
          onClick={async () => {
            const tactiveFolder = await window.api.joinPath([
              savePath,
              t.activeFolder,
            ]);
            if (tactiveFolder === activeFolder) {
              setScrollElement(t.element);
            } else {
              if (
                !activeFolder &&
                !confirm("Sure ? Unsaved progress will be lost ...")
              ) {
                return;
              }

              setActiveFolder(tactiveFolder);
              setScrollElement(t.element);
            }
          }}
        >
          <div className="overflow-x-hidden flex-1 ">
            <div className="min-w-screen flex gap-1 items-center">
              <Link className="size-4" />
              <p className="flex-1">{t.tag}</p>
            </div>
          </div>
          <CopyButton value={t.tag} />
        </div>
      ))}
    </div>
  );
};

export default TagSidebar;

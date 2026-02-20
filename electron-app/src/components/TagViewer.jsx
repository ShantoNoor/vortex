import { useEffect, useState } from "react";
import { uiStore } from "../lib/store";
import { Input } from "./ui/input";
import { CopyButton } from "./CopyButton";

const TagViewer = ({ activeFolder, savePath }) => {
  const [tags, setTags] = useState([]);
  const [tagsFiltered, setTagsFiltered] = useState([]);

  const [search, setSearch] = useState("");

  const setScrollElement = uiStore((state) => state.setScrollElement);

  useEffect(() => {
    (async function () {
      const data = await window.db.getByFolder({ activeFolder, savePath });
      setTags(data);
      setTagsFiltered(data);
    })();
  }, []);

  useEffect(() => {
    (async function () {
      if (search !== "") {
        const data = await window.db.searchTagInFolder({
          text: search,
          activeFolder,
          savePath,
        });
        setTagsFiltered(data);
      } else {
        setTagsFiltered(tags);
      }
    })();
  }, [search]);

  if (tags.length === 0) {
    return (
      <div className="h-full w-full flex justify-center items-center text-3xl">
        No tags found!..
      </div>
    );
  }

  return (
    <div className="text-lg">
      <div className="sticky top-0 z-10 bg-[#111] w-full">
        <Input
          placeholder="Search here..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-none text-lg!"
          // type="search"
        />
      </div>
      {tagsFiltered.map((t) => (
        <div
          key={t.id}
          className="min-h-8  border pl-3 py-1 cursor-pointer hover:border-blue-400! transition-colors"
          onClick={() => {
            setScrollElement(t.element);
          }}
        >
          <div className="flex items-center justify-between">
            <p className="flex-1 overflow-hidden">{t.tag}</p>
            <CopyButton value={t.tag} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TagViewer;

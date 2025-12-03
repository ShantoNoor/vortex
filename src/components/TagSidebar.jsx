import { useEffect, useState } from "react";
import { useUiStore } from "../lib/store";

const TagSidebar = () => {
  const [tags, setTags] = useState([]);
  const { setActiveFolder, activeFolder, setScrollElement } = useUiStore();

  useEffect(() => {
    (async function () {
      const data = await window.db.all();
      setTags(data);
    })();
  }, []);

  if (tags.length === 0) {
    return (
      <div className="h-full w-full flex justify-center items-center text-3xl">
        No tags found!..
      </div>
    );
  }
  return (
    <div className="space-y-2 p-2 overflow-x-hidden h-dvh no-scrollbar">
      {tags.map((t) => (
        <div
          key={t.id}
          className={`h-14 overflow-x-hidden border px-2 py-1 rounded-md cursor-pointer hover:border-blue-400 transition-colors flex flex-col justify-center ${t.activeFolder === activeFolder ? "border-white" : ""}`}
          onClick={() => {
            if (t.activeFolder === activeFolder) {
              setScrollElement(t.element);
            } else {
              if (
                !activeFolder &&
                !confirm("Sure ? Unsaved progress will be lost ...")
              ) {
                return;
              }
              setActiveFolder(t.activeFolder);
              setScrollElement(t.element);
            }
          }}
        >
          <p>{t.tag}</p>
          <p className="text-[12px]">{t.activeFolder}</p>
        </div>
      ))}
    </div>
  );
};

export default TagSidebar;

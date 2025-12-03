import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Trash } from "lucide-react";

const TagManager = ({ selectedElementId, activeFolder }) => {
  const [tag, setTag] = useState("");
  const [tags, setTags] = useState([]);

  useEffect(() => {
    (async function () {
      const data = await window.db.getByElement(selectedElementId);
      setTags(data);
    })();
  }, []);

  if (!activeFolder) {
    return (
      <div className="h-full w-full flex justify-center items-center text-3xl">
        Save First!...
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Write tag here..."
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            if (tag.trim() === "") return alert("Tag is empty");
            const id = await window.db.create({
              tag,
              element: selectedElementId,
              activeFolder,
            });
            setTags((t) => [
              ...t,
              { id, tag, element: selectedElementId, activeFolder },
            ]);
          }}
        >
          Add Tag
        </Button>
        <hr></hr>
        {tags.map((t) => (
          <div
            key={t.id}
            className="h-8 border flex items-center justify-between px-2 py-1 rounded-md hover:border-blue-400 transition-colors"
          >
            <p>{t.tag}</p>
            <Trash
              size={11}
              className="cursor-pointer"
              onClick={async () => {
                const res = await window.db.delete(t.id);
                if (res) {
                  setTags((pt) => pt.filter((i) => i.id !== t.id));
                }
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default TagManager;

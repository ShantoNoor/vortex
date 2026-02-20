import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Check, Edit, Trash, X } from "lucide-react";
import { CopyButton } from "./CopyButton";

const TagManager = ({ selectedElementId, activeFolder, savePath }) => {
  const [tag, setTag] = useState("");
  const [edit, setEdit] = useState("");
  const [tags, setTags] = useState([]);

  useEffect(() => {
    (async function () {
      const data = await window.db.getByElement(selectedElementId);
      setTags(
        data.map((it) => {
          return { ...it, edit: false };
        })
      );
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
      <div className="text-lg">
        <div className="space-y-0.5 sticky top-0 bg-[#111]!">
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Write tag here..."
            className="rounded-none text-lg!"
          />

          <Button
            variant="outline"
            className="w-full rounded-none text-md!"
            onClick={async () => {
              if (tag.trim() === "") return alert("Tag is empty");
              const id = await window.db.create({
                tag: tag.trim(),
                element: selectedElementId,
                activeFolder,
                savePath,
              });
              setTags((t) => [
                ...t,
                {
                  id,
                  tag,
                  element: selectedElementId,
                  activeFolder,
                  edit: false,
                },
              ]);
              setTag("");
            }}
          >
            Add Tag
          </Button>
        </div>

        {tags.map((t) => (
          <div
            key={t.id}
            className="min-h-8 border flex gap-1 items-center justify-between  hover:border-blue-400 transition-colors"
          >
            {!t.edit ? (
              <>
                <p className="flex-1 py-1 pl-3 overflow-hidden">{t.tag}</p>
                <CopyButton value={t.tag} />
                <Edit
                  className="cursor-pointer size-4"
                  onClick={() => {
                    setEdit(t.tag);
                    setTags((its) =>
                      its.map((it) =>
                        it.id !== t.id
                          ? { ...it, edit: false }
                          : { ...it, edit: true }
                      )
                    );
                  }}
                />
                <Trash
                  className="cursor-pointer size-4"
                  onClick={async () => {
                    if (!confirm("Sure? You want to delete ...")) return;
                    const res = await window.db.delete(t.id);
                    if (res) {
                      setTags((pt) => pt.filter((i) => i.id !== t.id));
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Input
                  value={edit}
                  onChange={(e) => setEdit(e.target.value)}
                  className="flex-1 rounded-none text-lg!"
                />
                <Check
                  className="cursor-pointer size-4"
                  onClick={async () => {
                    if (edit.trim() === "")
                      return alert("Can not update empty value.");

                    const res = await window.db.update(t.id, {
                      tag: edit,
                      element: selectedElementId,
                      activeFolder,
                      savePath,
                    });
                    const { changes } = res;

                    if (changes === 1) {
                      setEdit("");
                      setTags((its) =>
                        its.map((it) =>
                          it.id !== t.id
                            ? it
                            : { ...it, edit: false, tag: edit }
                        )
                      );
                    }
                  }}
                />
                <X
                  className="cursor-pointer size-4"
                  onClick={() => {
                    setTags((its) =>
                      its.map((it) =>
                        it.id !== t.id ? it : { ...it, edit: false }
                      )
                    );
                  }}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
};

export default TagManager;

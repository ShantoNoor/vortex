import { useEffect, useState } from "react";

const TagViewer = ({ activeFolder, scrollTo }) => {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    (async function () {
      const data = await window.db.getByFolder(activeFolder);
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
    <div className="space-y-2">
      {tags.map((t) => (
        <div
          key={t.id}
          className="h-8 border px-2 py-1 rounded-md cursor-pointer hover:border-blue-400 transition-colors"
          onClick={() => {
            scrollTo(t.element);
          }}
        >
          <p>{t.tag}</p>
        </div>
      ))}
    </div>
  );
};

export default TagViewer;

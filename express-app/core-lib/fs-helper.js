import fs from "fs/promises";
import path from "node:path";

import { cleanupDeletedFolders, cleanupFolderElements, initDB } from "./db.js";
import { addFiles, getFiles } from "./imagefs.js";

export async function readDirRecursive(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });

  const result = [];

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.name.startsWith(".") || item.name === "images") {
      continue;
    }

    if (item.isDirectory()) {
      const children = await readDirRecursive(fullPath);

      const target = path.basename(fullPath) + ".json";
      if (children.find((c) => c.name === target)) {
        result.push({ name: item.name, path: fullPath });
      } else {
        result.push([item.name, ...children]);
      }
    } else {
      if (item.name.endsWith(".json"))
        result.push({ name: item.name, path: fullPath });
    }
  }

  return result;
}

export async function selectFolder(folderPath, initdb = true) {
  try {
    const files = await readDirRecursive(folderPath);
    if (initdb)
      initDB(path.join(folderPath, `${path.basename(folderPath)}.db`));

    return { success: true, tree: files, path: folderPath };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function getFilesfs(folderPath, initdb = true) {
  try {
    const files = await readDirRecursive(folderPath);
    if (initdb) {
      initDB(path.join(folderPath, `${path.basename(folderPath)}.db`));
      cleanupDeletedFolders(folderPath);
    }

    return { success: true, tree: files };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function saveFile(payload) {
  try {
    let { activeFolder, elements, appState, fileList } = payload;

    if (!activeFolder) {
      return {
        success: false,
        error: "Unable to save no activeFolder selected!...",
      };
    }

    const filePath = path.join(
      activeFolder,
      `${path.basename(activeFolder)}.json`,
    );

    const fileContent = JSON.stringify(
      {
        elements,
        appState: { ...appState, name: path.basename(activeFolder) },
      },
      null,
      2,
    );

    await fs.writeFile(filePath, fileContent, "utf-8");
    await addFiles(fileList, activeFolder);

    return { success: true, activeFolder };
  } catch (error) {
    console.error("Failed to save file:", error);
    return { success: false, error: error.message };
  }
}

export async function openFile({ activeFolder, savePath }) {
  try {
    // 3️⃣ Save drawing.json
    const filePath = path.join(
      activeFolder,
      `${path.basename(activeFolder)}.json`,
    );

    const backupPath = path.join(
      activeFolder,
      `${path.basename(activeFolder)}.backup.json`,
    );

    await fs.copyFile(filePath, backupPath);

    const fileContent = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    const { elements: allElements, appState } = data;
    const elements = allElements.filter((el) => !el.isDeleted);

    const allElementIds = elements.map((e) => e.id);
    cleanupFolderElements(savePath, activeFolder, allElementIds);

    const idList = elements
      .filter((e) => e.type === "image")
      .map((e) => e.fileId);

    const files = await getFiles(idList, activeFolder);

    return { success: true, elements, appState, files, idList };
  } catch (error) {
    console.error("Failed to open file:", error);
    // Return the error to the renderer so the UI can show a notification
    return { success: false, error: error.message };
  }
}

export function joinPath(data) {
  return path.join(...data);
}

export function relativePath(savePath, activeFolder) {
  return path.relative(savePath, activeFolder);
}

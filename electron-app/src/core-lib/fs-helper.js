import fs from "fs/promises";
import path from "node:path";

import {
  cleanupDeletedFolders,
  cleanupFolderElements,
  createRecord,
  deleteRecord,
  getAllRecords,
  getByElement,
  getByFolder,
  getByTag,
  getRecord,
  initDB,
  searchTagContains,
  searchTagInActiveFolder,
  updateRecord,
} from "./db.js";

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

export async function selectFolder(folderPath) {
  try {
    const files = await readDirRecursive(folderPath);
    initDB(path.join(folderPath, `${path.basename(folderPath)}.db`));

    return { success: true, tree: files, path: folderPath };
  } catch (err) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

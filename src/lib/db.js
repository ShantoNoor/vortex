// db.js
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db;

export function initDB(dbPath) {
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      element TEXT NOT NULL,
      tag TEXT NOT NULL,
      activeFolder TEXT NOT NULL
    );
  `);

  return db;
}

export function createRecord({ element, tag, activeFolder, savePath }) {
  const relativeActiveFolder = path.relative(savePath, activeFolder);

  const stmt = db.prepare(`
    INSERT INTO items (element, tag, activeFolder)
    VALUES (?, ?, ?)
  `);

  const info = stmt.run(element, tag, relativeActiveFolder);
  return info.lastInsertRowid;
}

export function getRecord(id) {
  const stmt = db.prepare(`SELECT * FROM items WHERE id = ?`);
  return stmt.get(id);
}

export function getAllRecords() {
  const stmt = db.prepare(`SELECT * FROM items ORDER BY tag ASC`);
  return stmt.all();
}

export function updateRecord(id, { element, tag, activeFolder, savePath }) {
  const relativeActiveFolder = path.relative(savePath, activeFolder);

  const stmt = db.prepare(`
    UPDATE items
    SET element = ?, tag = ?, activeFolder = ?
    WHERE id = ?
  `);
  return stmt.run(element, tag, relativeActiveFolder, id);
}

export function deleteRecord(id) {
  const stmt = db.prepare(`DELETE FROM items WHERE id = ?`);
  return stmt.run(id).changes > 0;
}

export function getByTag(tag) {
  const stmt = db.prepare(`SELECT * FROM items WHERE tag = ?`);
  return stmt.all(tag);
}

export function getByElement(element) {
  const stmt = db.prepare(`SELECT * FROM items WHERE element = ?`);
  return stmt.all(element);
}

export function getByFolder({ activeFolder, savePath }) {
  const relativeActiveFolder = path.relative(savePath, activeFolder);

  const stmt = db.prepare(
    `SELECT * FROM items WHERE activeFolder = ? ORDER BY tag ASC`
  );
  return stmt.all(relativeActiveFolder);
}

export async function searchTagContains(text) {
  const groups = text
    .split("||")
    .map((group) =>
      group
        .trim()
        .split(/\s+/)
        .map((w) => `%${w.toLowerCase()}%`)
    )
    .filter((g) => g.length > 0);

  const orBlocks = groups
    .map((groupWords) => {
      const andBlock = groupWords.map(() => `LOWER(tag) LIKE ?`).join(" AND ");
      return `(${andBlock})`;
    })
    .join(" OR ");

  const stmt = db.prepare(`
    SELECT *
    FROM items
    WHERE ${orBlocks}
    ORDER BY LOWER(tag) ASC
  `);

  const flatWords = groups.flat();

  return stmt.all(...flatWords);
}

export async function searchTagInActiveFolder({
  text,
  activeFolder,
  savePath,
}) {
  const relativeActiveFolder = path.relative(savePath, activeFolder);

  const groups = text
    .split("||")
    .map((group) =>
      group
        .trim()
        .split(/\s+/)
        .map((w) => `%${w.toLowerCase()}%`)
    )
    .filter((g) => g.length > 0);

  const orBlocks = groups
    .map((groupWords) => {
      const andBlock = groupWords.map(() => `LOWER(tag) LIKE ?`).join(" AND ");

      return `(${andBlock})`;
    })
    .join(" OR ");

  const stmt = db.prepare(`
    SELECT *
    FROM items
    WHERE activeFolder = ?
      AND (${orBlocks})
    ORDER BY LOWER(tag) ASC
  `);

  const flatWords = groups.flat();

  return stmt.all(relativeActiveFolder, ...flatWords);
}

export function cleanupDeletedFolders(savePath) {
  const stmt = db.prepare(`SELECT DISTINCT activeFolder FROM items`);
  const rows = stmt.all();

  const deleteStmt = db.prepare(`DELETE FROM items WHERE activeFolder = ?`);

  for (const row of rows) {
    const folderName = row.activeFolder;
    if (!folderName) continue;

    const folderPath = path.join(savePath, folderName);

    if (!fs.existsSync(folderPath)) {
      deleteStmt.run(folderName);
      // console.log("Removed orphaned DB data for:", folderName);
    }
  }
}

export function cleanupFolderElements(savePath, activeFolder, allElementIds) {
  const relativeActiveFolder = path.relative(savePath, activeFolder);

  const stmt = db.prepare(`
    SELECT DISTINCT element
    FROM items 
    WHERE activeFolder = ?
  `);

  const rows = stmt.all(relativeActiveFolder);
  const dbElements = rows.map((r) => r.element);

  const deleteStmt = db.prepare(`
    DELETE FROM items 
    WHERE activeFolder = ? AND element = ?
  `);

  for (const element of dbElements) {
    if (!allElementIds.includes(element)) {
      deleteStmt.run(relativeActiveFolder, element);
      // console.log(
      //   `Removed orphan element ${element} from folder ${activeFolder}`
      // );
    }
  }
}

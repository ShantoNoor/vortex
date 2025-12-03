// db.js
import Database from "better-sqlite3";

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

export function createRecord({ element, tag, activeFolder }) {
  const stmt = db.prepare(`
    INSERT INTO items (element, tag, activeFolder)
    VALUES (?, ?, ?)
  `);
  const info = stmt.run(element, tag, activeFolder);
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

export function updateRecord(id, { element, tag, activeFolder }) {
  const stmt = db.prepare(`
    UPDATE items
    SET element = ?, tag = ?, activeFolder = ?
    WHERE id = ?
  `);
  return stmt.run(element, tag, activeFolder, id);
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

export function getByFolder(activeFolder) {
  const stmt = db.prepare(`SELECT * FROM items WHERE activeFolder = ? ORDER BY tag ASC`);
  return stmt.all(activeFolder);
}

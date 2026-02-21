import express from "express";
import cors from "cors";
import {
  getFilesfs,
  joinPath,
  openFile,
  relativePath,
  saveFile,
  selectFolder,
} from "./core-lib/fs-helper.js";
import {
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
} from "./core-lib/db.js";
import path from "node:path";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1000mb" }));

const PORT = 5000;
// const folderPath = "/home/shanto/Documents/notes/";
const folderPath = "/home/shanto/Downloads/test/";

initDB(path.join(folderPath, `${path.basename(folderPath)}.db`));

app.get("/", async (req, res) => {
  res.send("Hello vortex!...");
});

app.get("/select-folder", async (req, res) => {
  res.json(await selectFolder(folderPath, false));
});
app.get("/get-files", async (req, res) => {
  res.json(await getFilesfs(folderPath, false));
});
app.post("/open-file", async (req, res) => {
  const { activeFolder, savePath } = req.body;
  res.json(await openFile({ activeFolder, savePath }));
});
app.post("/save-file", async (req, res) => {
  const payload = req.body;
  res.json(await saveFile(payload));
});
app.post("/join-path", async (req, res) => {
  const data = req.body;
  res.json(joinPath(data));
});
app.post("/relative-path", async (req, res) => {
  const { savePath, activeFolder } = req.body;
  res.json(relativePath(savePath, activeFolder));
});

app.get("/db-all", async (req, res) => {
  res.json(await getAllRecords());
});
app.post("/db-create", async (req, res) => {
  const data = req.body;
  res.json(await createRecord(data));
});
app.post("/db-get", async (req, res) => {
  const { id } = req.body;
  res.json(await getRecord(id));
});
app.post("/db-update", async (req, res) => {
  const { id, data } = req.body;
  res.json(await updateRecord(id, data));
});
app.post("/db-delete", async (req, res) => {
  const { id } = req.body;
  res.json(await deleteRecord(id));
});
app.post("/db-getByTag", async (req, res) => {
  const tag = req.body;
  res.json(await getByTag(tag));
});
app.post("/db-getByElement", async (req, res) => {
  const { element } = req.body;
  res.json(await getByElement(element));
});
app.post("/db-getByFolder", async (req, res) => {
  const data = req.body;
  res.json(await getByFolder(data));
});
app.post("/db-search-tag", async (req, res) => {
  const { text } = req.body;
  res.json(await searchTagContains(text));
});
app.post("/db-search-tag-activeFolder", async (req, res) => {
  const data = req.body;
  res.json(await searchTagInActiveFolder(data));
});

app.listen(PORT, () => {
  console.log(`Quiz API running on http://localhost:${PORT}`);
});

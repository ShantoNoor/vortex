import express from "express";
import cors from "cors";
import {
  getFilesfs,
  openFile,
  saveFile,
  selectFolder,
} from "./core-lib/fs-helper.js";
import { initDB } from "./core-lib/db.js";
import path from "node:path";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1000mb" }));

const PORT = 3000;
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

app.listen(PORT, () => {
  console.log(`Quiz API running on http://localhost:${PORT}`);
});

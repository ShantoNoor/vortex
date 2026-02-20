import express from "express";
import cors from "cors";
import { getFilesfs, openFile, selectFolder } from "./core-lib/fs-helper.js";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
// const folderPath = "/home/shanto/Documents/notes/";
const folderPath = "/home/shanto/Downloads/test/";

app.get("/", async (req, res) => {
  res.send("Hello vortex!...");
});

app.get("/select-folder", async (req, res) => {
  res.json(await selectFolder(folderPath));
});

app.get("/get-files", async (req, res) => {
  res.json(await getFilesfs(folderPath));
});

app.post("/open-file", async (req, res) => {
  const { activeFolder, savePath } = req.body;
  res.json(await openFile({ activeFolder, savePath }));
});

app.listen(PORT, () => {
  console.log(`Quiz API running on http://localhost:${PORT}`);
});

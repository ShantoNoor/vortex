import express from "express";
import cors from "cors";
import { selectFolder } from "./core-lib/fs-helper.js";

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3000;
const folderPath = "/home/shanto/Documents/notes/";

app.get("/", async (req, res) => {
  res.send("Hello vortex!...");
});

app.get("/select-folder", async (req, res) => {
  res.json(await selectFolder(folderPath));
});

app.listen(PORT, () => {
  console.log(`Quiz API running on http://localhost:${PORT}`);
});

import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import fs from "fs/promises";
import path from "node:path";
import started from "electron-squirrel-startup";
import { addFiles, getFiles } from "./lib/imagefs";

if (started) {
  app.quit();
}

const createWindow = () => {
  Menu.setApplicationMenu(null);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    backgroundColor: "#222",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled) return null;

  const folderPath = result.filePaths[0];

  try {
    const files = await readDirRecursive(folderPath);
    return { success: true, tree: files, path: folderPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-files", async (event, folderPath) => {
  try {
    const files = await readDirRecursive(folderPath);
    return { success: true, tree: files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("save-file", async (event, payload) => {
  let { activeFolder, elements, appState, fileList, savePath } = payload;

  try {
    // 1️⃣ If no active folder, let user choose
    if (!activeFolder) {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        defaultPath: savePath,
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, reason: "canceled" };
      }

      activeFolder = result.filePaths[0];
    }

    // 3️⃣ Save drawing.json
    const filePath = path.join(
      activeFolder,
      `${path.basename(activeFolder)}.json`
    );

    const fileContent = JSON.stringify(
      {
        elements,
        appState: { ...appState, name: path.basename(activeFolder) },
      },
      null,
      2
    );

    await fs.writeFile(filePath, fileContent, "utf-8");

    await addFiles(fileList, activeFolder);

    return { success: true, activeFolder };
  } catch (error) {
    console.error("Failed to save file:", error);
    // Return the error to the renderer so the UI can show a notification
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-file", async (event, activeFolder) => {
  try {
    // 3️⃣ Save drawing.json
    const filePath = path.join(
      activeFolder,
      `${path.basename(activeFolder)}.json`
    );

    const fileContent = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);
    const { elements: allElements, appState } = data;
    const elements = allElements.filter((el) => !el.isDeleted);

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
});

export async function readDirRecursive(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });

  const result = [];

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.name === "images") {
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
      result.push({ name: item.name, path: fullPath });
    }
  }

  return result;
}

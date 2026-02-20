import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import {
  createRecord,
  deleteRecord,
  getAllRecords,
  getByElement,
  getByFolder,
  getByTag,
  getRecord,
  searchTagContains,
  searchTagInActiveFolder,
  updateRecord,
} from "./core-lib/db.js";
import { selectFolder, getFilesfs, saveFile, openFile, joinPath, relativePath } from "./core-lib/fs-helper.js";

if (started) {
  app.quit();
}

const createWindow = () => {
  Menu.setApplicationMenu(null);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    width: 1400,
    height: 800,
    backgroundColor: "#222",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      webviewTag: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools ONLY if the app is NOT packaged (Development mode)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
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

  return await selectFolder(folderPath)
});

ipcMain.handle("get-files", async (event, folderPath) => await getFilesfs(folderPath));

ipcMain.handle("save-file", async (event, payload) => {
  let { activeFolder, savePath } = payload;

  if (!activeFolder) {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        defaultPath: savePath,
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, reason: "canceled" };
      }

      activeFolder = result.filePaths[0];
    } catch (error) {
      console.error("Failed to save file:", error);
      // Return the error to the renderer so the UI can show a notification
      return { success: false, error: error.message };
    }
  }

  return await saveFile({...payload, activeFolder})
});

ipcMain.handle("open-file", async (event, payload) => await openFile(payload));

ipcMain.handle("db:create", (_, data) => createRecord(data));
ipcMain.handle("db:get", (_, id) => getRecord(id));
ipcMain.handle("db:all", () => getAllRecords());
ipcMain.handle("db:update", (_, id, data) => updateRecord(id, data));
ipcMain.handle("db:delete", (_, id) => deleteRecord(id));

ipcMain.handle("db:getByTag", (_, tag) => getByTag(tag));
ipcMain.handle("db:getByElement", (_, element) => getByElement(element));
ipcMain.handle("db:getByFolder", (_, data) => getByFolder(data));
ipcMain.handle("db:search-tag", (_, text) => searchTagContains(text));
ipcMain.handle("db:search-tag-activeFolder", (_, data) =>
  searchTagInActiveFolder(data),
);

ipcMain.handle("path:join", (_, data) => joinPath(data));
ipcMain.handle("path:relative", (_, savePath, activeFolder) => relativePath(savePath, activeFolder));

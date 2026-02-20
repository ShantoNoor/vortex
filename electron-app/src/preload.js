import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  getFiles: (path) => ipcRenderer.invoke("get-files", path),
  handleSave: (payload) => ipcRenderer.invoke("save-file", payload),
  openFile: (data) => ipcRenderer.invoke("open-file", data),
  joinPath: (data) => ipcRenderer.invoke("path:join", data),
  relativePath: (savePath, activeFolder) =>
    ipcRenderer.invoke("path:relative", savePath, activeFolder),
});

contextBridge.exposeInMainWorld("db", {
  create: (data) => ipcRenderer.invoke("db:create", data),
  get: (id) => ipcRenderer.invoke("db:get", id),
  all: () => ipcRenderer.invoke("db:all"),
  update: (id, data) => ipcRenderer.invoke("db:update", id, data),
  delete: (id) => ipcRenderer.invoke("db:delete", id),
  getByTag: (tag) => ipcRenderer.invoke("db:getByTag", tag),
  getByElement: (element) => ipcRenderer.invoke("db:getByElement", element),
  getByFolder: (data) => ipcRenderer.invoke("db:getByFolder", data),
  searchTag: (text) => ipcRenderer.invoke("db:search-tag", text),
  searchTagInFolder: (data) =>
    ipcRenderer.invoke("db:search-tag-activeFolder", data),
});

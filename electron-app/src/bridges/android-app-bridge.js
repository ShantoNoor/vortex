window.pendingPromises = {};
window.promiseCounter = 0;

window.resolvePromise = (id, result) => {
  const handler = window.pendingPromises[id];
  handler.resolve(result);
  delete window.pendingPromises[id];
};

window.api = window.api || {};
window.api.getFiles = (folderPath) => {
  return new Promise((resolve, reject) => {
    const id = window.promiseCounter++;
    window.pendingPromises[id] = { resolve, reject };
    window.android.getFiles(folderPath, id);
  });
};

window.api.folderPicker = () => {
  return new Promise((resolve, reject) => {
    const id = window.promiseCounter++;
    window.pendingPromises[id] = { resolve, reject };
    window.android.folderPicker(id);
  });
};
window.api.selectFolder = async () => {
  const res = await window.api.folderPicker();
  if (res.success) return await window.api.getFiles(res.path);
  return res;
};

window.api.handleSave = async (payload) => {
  if (!payload?.activeFolder) {
    const res = await window.api.folderPicker();
    if (res.success) {
      if (!res.isEmpty)
        return { success: false, error: "Folder is not Empty" };

      payload.activeFolder = res.path;
    } else return res;
  }

  return new Promise((resolve, reject) => {
    const id = window.promiseCounter++;
    window.pendingPromises[id] = { resolve, reject };
    window.android.saveFile(JSON.stringify(payload), id);
  });
};

window.api.openFile = (payload) => {
  return new Promise((resolve, reject) => {
    const id = window.promiseCounter++;
    window.pendingPromises[id] = { resolve, reject };
    window.android.openFile(JSON.stringify(payload), id);
  });
};

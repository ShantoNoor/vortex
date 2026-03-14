window.pendingPromises = {};
window.promiseCounter = 0;

window.resolvePromise = function (id, result) {
  console.log(result);
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

window.api.selectFolder = () => {
  return new Promise((resolve, reject) => {
    const id = window.promiseCounter++;
    window.pendingPromises[id] = { resolve, reject };
    window.android.selectFolder(id);
  });
};

window.api.handleSave = (payload) => {
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
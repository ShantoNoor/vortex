if (import.meta.env.VITE_ANDROID_BUILD) {
  window.pendingPromises = {};
  window.promiseCounter = 0;

  window.resolvePromise = (id, result) => {
    const handler = window.pendingPromises[id];
    handler.resolve(result);
    delete window.pendingPromises[id];
  };

  window.api = window.api || {};
  window.db = window.db || {};

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

  window.api.getImage = (payload) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.getImage(JSON.stringify(payload), id);
    });
  };

  window.api.saveImage = (payload) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.saveImage(JSON.stringify(payload), id);
    });
  };

  window.api.clearImageCache = () => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.clearImageCache(id);
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
          return {
            success: false,
            error: "⚠️ Folder not empty",
          };
        if (!res.path.startsWith(payload.savePath))
          return {
            success: false,
            error: "⚠️ Select an empty folder inside: " + payload.savePath,
          };
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

  window.api.joinPath = (data) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.joinPath(JSON.stringify(data), id);
    });
  };

  window.api.relativePath = (savePath, activeFolder) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.relativePath(savePath, activeFolder, id);
    });
  };

  window.db.all = () => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbAll(id);
    });
  };

  window.db.create = (data) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbCreate(JSON.stringify(data), id);
    });
  };

  window.db.update = (id, data) => {
    return new Promise((resolve, reject) => {
      const cb_id = window.promiseCounter++;
      window.pendingPromises[cb_id] = { resolve, reject };
      window.android.dbUpdate(id, JSON.stringify(data), cb_id);
    });
  };

  window.db.delete = (id) => {
    return new Promise((resolve, reject) => {
      const cb_id = window.promiseCounter++;
      window.pendingPromises[cb_id] = { resolve, reject };
      window.android.dbDelete(id, cb_id);
    });
  };

  window.db.getByElement = (element) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbGetByElement(element, id);
    });
  };

  window.db.getByFolder = (data) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbGetByFolder(JSON.stringify(data), id);
    });
  };

  window.db.searchTag = (text) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbSearchTag(text, id);
    });
  };

  window.db.searchTagInFolder = (data) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbSearchTagActiveFolder(JSON.stringify(data), id);
    });
  };

  window.db.getByTag = (tag) => {
    return new Promise((resolve, reject) => {
      const id = window.promiseCounter++;
      window.pendingPromises[id] = { resolve, reject };
      window.android.dbGetByTag(tag, id);
    });
  };
}

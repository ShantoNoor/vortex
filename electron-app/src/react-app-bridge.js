export const api = {};

const URI = import.meta.env.VITE_API_URL;

api.getFiles = async (folderPath) => {
  const res = await fetch(`${URI}/get-files`);
  return await res.json();
};

api.selectFolder = async (folderPath) => {
  const res = await fetch(`${URI}/select-folder`);
  return await res.json();
};

api.openFile = async ({ activeFolder, savePath }) => {
  try {
    const response = await fetch(`${URI}/open-file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        activeFolder: activeFolder,
        savePath: savePath,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: error.message };
  }
};

api.handleSave = async (payload) => {
  try {
    const response = await fetch(`${URI}/save-file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: error.message };
  }
};

api.joinPath = async (data) => {
  try {
    const response = await fetch(`${URI}/join-path`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const data1 = await response.json();
    return data1;
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: error.message };
  }
};

api.relativePath = async (savePath, activeFolder) => {
  try {
    const response = await fetch(`${URI}/relative-path`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ savePath, activeFolder }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: error.message };
  }
};

export const db = {
  create: async (data) => {
    try {
      const response = await fetch(`${URI}/db-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const data1 = await response.json();
      return data1;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  get: async (id) => {
    try {
      const response = await fetch(`${URI}/db-get`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  all: async () => {
    const res = await fetch(`${URI}/db-all`);
    return await res.json();
  },
  update: async (id, data) => {
    try {
      const response = await fetch(`${URI}/db-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, data }),
      });

      const data1 = await response.json();
      return data1;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  delete: async (id) => {
    try {
      const response = await fetch(`${URI}/db-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  getByTag: async (tag) => {
    console.log(tag);
    try {
      const response = await fetch(`${URI}/db-getByTag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tag),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  getByElement: async (element) => {
    try {
      const response = await fetch(`${URI}/db-getByElement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ element }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  getByFolder: async (data) => {
    try {
      const response = await fetch(`${URI}/db-getByFolder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const data1 = await response.json();
      return data1;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  searchTag: async (text) => {
    try {
      const response = await fetch(`${URI}/db-search-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
  searchTagInFolder: async (data) => {
    try {
      const response = await fetch(`${URI}/db-search-tag-activeFolder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const data1 = await response.json();
      return data1;
    } catch (error) {
      console.error("Error:", error);
      return { success: false, error: error.message };
    }
  },
};

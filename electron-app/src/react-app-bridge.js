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

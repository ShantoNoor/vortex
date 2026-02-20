import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";

if (import.meta.env.VITE_API_URL) {
  const URI = import.meta.env.VITE_API_URL;

  // Initialize window.api so it is not undefined
  window.api = window.api || {};

  window.api.getFiles = async (folderPath) => {
    const res = await fetch(`${URI}/get-files`);
    return await res.json();
  };

  window.api.selectFolder = async (folderPath) => {
    const res = await fetch(`${URI}/select-folder`);
    return await res.json();
  };

  window.api.openFile = async ({ activeFolder, savePath }) => {
  try {
    const response = await fetch(`${URI}/open-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        activeFolder: activeFolder,
        savePath: savePath
      }),
    });

    const data = await response.json();
    console.log('Success:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
};
}

const root = createRoot(document.getElementById("app"));
root.render(<App />);

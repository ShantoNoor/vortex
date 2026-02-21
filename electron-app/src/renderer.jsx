import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";
import { api, db } from "./react-app-bridge";

if (import.meta.env.VITE_API_URL) {
  window.api = api;
  window.db = db;
}

const root = createRoot(document.getElementById("app"));
root.render(<App />);

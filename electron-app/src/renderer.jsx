import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";

if (import.meta.env.VITE_API_URL) {
}

const root = createRoot(document.getElementById("app"));
root.render(<App />);

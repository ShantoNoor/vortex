import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";

// import "./bridges/react-app-bridge";
import "./bridges/android-app-bridge";

const root = createRoot(document.getElementById("app"));
root.render(<App />);

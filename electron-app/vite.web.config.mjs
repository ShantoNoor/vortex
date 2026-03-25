import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === "build" ? "/vortex/" : "/",
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      allow: [
        // Allow serving files from the standard workspace root
        searchForWorkspaceRoot(process.cwd()),

        // Explicitly allow your local Excalidraw directory
        "/home/shanto/Downloads/excalidraw",
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:55000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        ws: true,
      },
      "/socket.io": {
        target: "http://localhost:55000",
        // changeOrigin: true,
        ws: true,
      },
    },
  },
}));

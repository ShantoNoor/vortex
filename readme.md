# Vortex

![cover.png](cover.png)

Vortex is my personal Knowledge Management System (KMS), designed to organize ideas, documents, and workflows visually.  
It is built around **Excalidraw**, giving me a fast, flexible, and intuitive canvas for thought.

## ✨ Features

- 🧩 Visual-first knowledge organization using Excalidraw
- 🗂️ Manage folders, notes, PDFs, and sketches all in one place
- ⚡ Fast local storage — no cloud required
- 🔍 Easy search and quick navigation
- 🖥️ Built with Electron for a smooth desktop experience

## 📦 Tech Stack

- **Electron**
- **React**
- **Excalidraw**
- **Node.js / fs**
- **ShadCN UI / Tailwind CSS**

#### Fedora Linux Build Issue Solve:

> https://github.com/electron/forge/issues/3701

#### Find RPM Package Name:

```bash
rpm -qa | grep -i "vortex"
```

# Project Setup

yarn link vortex-core-lib-js @excalidraw/excalidraw @excalidraw/math @excalidraw/element @excalidraw/common

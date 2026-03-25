import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function generateUUID() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // fallback using crypto.getRandomValues (works in most WebViews)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const toHex = (num) => num.toString(16).padStart(2, "0");
    let i = 0;
    return [
      ...buf.slice(0, 4),
      "-",
      ...buf.slice(4, 6),
      "-",
      ...buf.slice(6, 8),
      "-",
      ...buf.slice(8, 10),
      "-",
      ...buf.slice(10, 16),
    ]
      .map((b) => (typeof b === "string" ? b : toHex(b)))
      .join("");
  }
  // last resort fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function base64ToArrayBuffer(base64String) {
    const binaryString = atob(base64String);
    const len = binaryString.length;
    const array = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        array[i] = binaryString.charCodeAt(i);
    }
    return array.buffer;
}

export function arrayBufferToBase64(buffer) {
    const array = Uint16Array.from(new Uint8Array(buffer));
    const binaryString = new TextDecoder("UTF-16").decode(array);
    return btoa(binaryString);
}

export function getImageDimensions(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataURL;
  });
}

export function getCanvasBlob(canvas, mimeType = "image/png", quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas to Blob conversion failed."));
        }
      },
      mimeType,
      quality,
    );
  });
}
export function getBoundingBox(el) {
  return {
    left: el.x,
    right: el.x + el.width,
    top: el.y,
    bottom: el.y + el.height,
  };
}

export function isOverlapping(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

export function boxDistance(a, b) {
  const dx = Math.max(b.left - a.right, a.left - b.right, 0);

  const dy = Math.max(b.top - a.bottom, a.top - b.bottom, 0);

  return dx * dx + dy * dy;
}

export function base64ToArrayBuffer(base64) {
  return Buffer.from(base64, "base64").buffer;
}

export function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

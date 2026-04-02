import { useEffect } from "react";

export default function useTouchSafety() {
  useEffect(() => {
    let activePointers = new Set();

    const resetState = () => {
      activePointers.clear();

      // 🔥 Force reset (important for canvas apps)
      window.dispatchEvent(new Event("pointerup"));
    };

    const onPointerDown = (e) => {
      activePointers.add(e.pointerId);
    };

    const onPointerUp = (e) => {
      activePointers.delete(e.pointerId);
    };

    const onPointerCancel = () => {
      resetState();
    };

    const onTouchStart = (e) => {
      // 🚫 Block 3+ touches at JS level (backup)
      if (e.touches.length >= 3) {
        e.preventDefault();
        resetState();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("touchstart", onTouchStart, { passive: false });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);
}
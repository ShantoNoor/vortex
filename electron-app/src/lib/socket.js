import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.PROD ? null : "http://localhost:5000",
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 3,
  },
);

export const checkHealth = async () => {
  try {
    const res = await fetch("/api/health");

    if (res.status === 200) {
      return { success: true };
    }

    return { success: false };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

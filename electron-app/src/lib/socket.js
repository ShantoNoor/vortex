import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.VITE_API_URL ? null : "http://localhost:5000",
  {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 3,
  },
);

export const checkHealth = async () => {
  try {
    const res = await fetch(
      import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/health`
        : "http://localhost:5000/health",
    );

    if (res.status === 200) {
      return { success: true };
    }

    return { success: false };
  } catch (error) {
    console.log(error);
    return { success: false };
  }
};

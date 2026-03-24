import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.VITE_WEB_BUILD ? null : "http://localhost:55000",
  {
    autoConnect: import.meta.env.VITE_ANDROID_BUILD ? false : true,
    reconnection: true,
    reconnectionAttempts: 3,
  },
);

export const checkHealth = async () => {
  try {
    const res = await fetch(
      import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/health`
        : "http://localhost:55000/health",
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

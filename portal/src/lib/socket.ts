import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });
  }
  return socket;
}

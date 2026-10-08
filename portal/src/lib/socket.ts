import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore.js';
import { SOCKET_URL } from './env.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });
  }
  return socket;
}

import type { User } from '@meetingpnt/shared';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: 'unknown' | 'authenticated' | 'unauthenticated';
  setSession: (user: User, accessToken: string) => void;
  /** The same person, re-fetched — a new photo, a changed name. Leaves the token alone. */
  setUser: (user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'unknown',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  clearSession: () => set({ user: null, accessToken: null, status: 'unauthenticated' }),
}));

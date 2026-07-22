import { create } from 'zustand';
import { getUser } from '@/lib/auth';

interface AuthUser {
  userId: string;
  username: string;
}

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  loadUser: async () => {
    set({ loading: true });
    const user = await getUser();
    set({ user: user ?? null, loading: false });
  },
}));

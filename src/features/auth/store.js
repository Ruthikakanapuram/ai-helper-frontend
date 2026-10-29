import { create } from 'zustand';
const STORAGE = 'ai-helper-user';
function fromStorage() { try {
    return JSON.parse(localStorage.getItem(STORAGE) || 'null');
}
catch {
    return null;
} }
export const useAuth = create((set) => ({ user: fromStorage(), setUser: (user) => { localStorage.setItem(STORAGE, JSON.stringify(user)); set({ user }); }, logout: () => { localStorage.removeItem(STORAGE); set({ user: null }); } }));

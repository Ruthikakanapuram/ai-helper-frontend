
import { create } from 'zustand';

const USER_STORAGE = 'ai-helper-user';
const TOKEN_STORAGE = 'accessToken';

// Decode JWT payload
// Note: This does not verify the JWT signature.
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];

    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '='
    );

    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// Restore a valid session after refresh
function restoreSession() {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE);
    const storedUser = JSON.parse(
      localStorage.getItem(USER_STORAGE) || 'null'
    );

    if (!token || !storedUser) {
      return { user: null, token: null };
    }

    const payload = decodeToken(token);

    if (
      !payload ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 <= Date.now()
    ) {
      localStorage.removeItem(TOKEN_STORAGE);
      localStorage.removeItem(USER_STORAGE);

      return { user: null, token: null };
    }

    const role = String(payload.role || '').toUpperCase();

    if (
      !['TEACHER', 'STUDENT', 'ADMIN'].includes(role) ||
      String(payload.sub) !== String(storedUser.id)
    ) {
      localStorage.removeItem(TOKEN_STORAGE);
      localStorage.removeItem(USER_STORAGE);

      return { user: null, token: null };
    }

    return {
      user: {
        ...storedUser,
        id: String(payload.sub),
        role,
      },
      token,
    };
  } catch {
    return { user: null, token: null };
  }
}

const initialSession = restoreSession();

export const useAuth = create((set) => ({
  user: initialSession.user,
  token: initialSession.token,

  // Save authenticated user and JWT together
  setSession: (user, token) => {
    localStorage.setItem(USER_STORAGE, JSON.stringify(user));
    localStorage.setItem(TOKEN_STORAGE, token);

    set({ user, token });
  },

  // Preserve compatibility with existing components
  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_STORAGE, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE);
    }

    set({ user });
  },

  // Clear complete authentication session
  logout: () => {
    localStorage.removeItem(USER_STORAGE);
    localStorage.removeItem(TOKEN_STORAGE);

    set({
      user: null,
      token: null,
    });
  },
}));

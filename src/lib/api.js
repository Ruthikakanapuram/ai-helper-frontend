
const ROOT =
  import.meta.env.VITE_USE_MOCKS === 'false'
    ? import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    : '/api';

// Get the stored JWT
export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

// Save JWT after login
export function saveAccessToken(token) {
  localStorage.setItem('accessToken', token);
}

// Clear JWT on logout
export function clearAccessToken() {
  localStorage.removeItem('accessToken');
}

// Decode JWT payload (not a signature verification)
export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];

    if (!payload) {
      throw new Error('Invalid JWT');
    }

    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '='
    );

    return JSON.parse(atob(padded));
  } catch {
    throw new Error('Unable to decode authentication token');
  }
}

// Shared HTTP request function
async function request(path, init = {}) {
  const token = getAccessToken();

  const response = await fetch(`${ROOT}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let description = `Request failed (${response.status})`;

    try {
      const error = await response.json();

      if (error.message) {
        description = Array.isArray(error.message)
          ? error.message.join(', ')
          : error.message;
      }
    } catch {
      // Non-JSON error response
    }

    throw new Error(description);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

const json = (body) => JSON.stringify(body);

export const api = {
  // Authentication
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: json({ username, password }),
    }),

  // Teacher activities
  getActivities: () =>
    request('/activities'),

  getActivity: (id) =>
    request(`/activities/${id}`),

  createActivity: (body) =>
    request('/activities', {
      method: 'POST',
      body: json(body),
    }),

  startActivity: (id) =>
    request(`/activities/${id}/start`, {
      method: 'POST',
    }),

  stopActivity: (id) =>
    request(`/activities/${id}/stop`, {
      method: 'POST',
    }),

  // Students
  getStudentsByFilter: (branch, year, section) =>
    request(
      `/students?${new URLSearchParams({
        ...(branch ? { branch } : {}),
        ...(year ? { year } : {}),
        ...(section ? { section } : {}),
      })}`
    ),

  // Chat sessions
  getSession: (activityId, studentId) =>
    request(
      `/activities/${activityId}/sessions/${studentId}`
    ),

  createSession: (activityId, studentId) =>
    request(`/activities/${activityId}/sessions`, {
      method: 'POST',
      body: json({ studentId }),
    }),

  sendMessage: (activityId, studentId, content) =>
    request(
      `/activities/${activityId}/sessions/${studentId}/messages`,
      {
        method: 'POST',
        body: json({ content }),
      }
    ),

  endSession: (activityId, studentId) =>
    request(
      `/activities/${activityId}/sessions/${studentId}/end`,
      {
        method: 'POST',
      }
    ),

  // Admin
  getStats: () =>
    request('/admin/stats'),

  getUsers: (role) =>
    request(
      `/admin/users?role=${encodeURIComponent(role)}`
    ),
};

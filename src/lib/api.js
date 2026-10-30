
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

export function normalizeActivity(activity) {
  return {
    ...activity,

    id: String(activity.id),

    // Backend title -> Frontend name
    name: activity.title ?? activity.name ?? '',

    topic: activity.topic ?? '',

    description: activity.description ?? '',

    duration: activity.duration ?? 30,

    scheduledDate: activity.scheduledDate ?? null,

    startedAt: activity.startedAt ?? null,

    endedAt: activity.endedAt ?? null,

    status: activity.status,

    studentIds: Array.isArray(activity.studentIds)
      ? activity.studentIds.map(String)
      : [],

    createdAt: activity.createdAt,
  };
}

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


updateActivityStatus: (id, status) =>
  request(`/activities/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),

startActivity: (id) =>
  request(`/activities/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'PUBLISHED',
    }),
  }),

stopActivity: (id) =>
  request(`/activities/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'CLOSED',
    }),
  }),


  // Students
    // Get students
  getStudentsList: () =>
    request('/students'),
  
   getStudentsByFilter: (branch, year, section) =>
    request(
      `/students?${new URLSearchParams({
        ...(branch ? { branch } : {}),
        ...(year ? { year } : {}),
        ...(section ? { section } : {}),
      })}`
    ),

  // Create one or multiple students
  createStudentsBulk: (students) =>
    request('/students/bulk-students', {
      method: 'POST',
      body: JSON.stringify({ students }),
    }),

  // Chat sessions


// Create the session on first entry.
// Repeated calls return the existing session.
enterActivity: (activityId) =>
  request('/chat-sessions', {
    method: 'POST',
    body: JSON.stringify({
      activityId: Number(activityId),
    }),
  }),

// Confirmed only if your ChatSessionsController
// exposes GET /chat-sessions/:id.
getChatSessionById: (sessionId) =>
  request(`/chat-sessions/${sessionId}`),
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

    //student chat
    sendChatPrompt: (sessionId, prompt, clientRequestId) =>
  request('/chat-messages/send', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: Number(sessionId),
      prompt,
      clientRequestId,
    }),
  }),
//chat histry for student
getChatHistory: (sessionId) =>
  request(
    `/chat-messages/session/${encodeURIComponent(sessionId)}/history`
  ),
  // Admin
  getStats: () =>
    request('/admin/stats'),

  getUsers: (role) =>
    request(
      `/admin/users?role=${encodeURIComponent(role)}`
    ),
};

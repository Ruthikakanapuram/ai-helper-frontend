const ROOT = import.meta.env.VITE_USE_MOCKS === 'false' ? (import.meta.env.VITE_API_URL || 'http://localhost:3000/api') : '/api';
async function request(path, init) {
    const res = await fetch(`${ROOT}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
    if (!res.ok) {
        let description = `Request failed (${res.status})`;
        try {
            const err = await res.json();
            if (err.message)
                description = err.message;
        }
        catch { /* non-JSON error */ }
        throw new Error(description);
    }
    return res.json();
}
const json = (body) => JSON.stringify(body);
export const api = {
    login: (username, password) => request('/auth/login', { method: 'POST', body: json({ username, password }) }),
    getActivities: () => request('/activities'),
    getActivity: (id) => request(`/activities/${id}`),
    createActivity: (body) => request('/activities', { method: 'POST', body: json(body) }),
    startActivity: (id) => request(`/activities/${id}/start`, { method: 'POST' }),
    stopActivity: (id) => request(`/activities/${id}/stop`, { method: 'POST' }),
    getStudentsByFilter: (branch, year, section) => request(`/students?${new URLSearchParams({ ...(branch ? { branch } : {}), ...(year ? { year } : {}), ...(section ? { section } : {}) })}`),
    getSession: (activityId, studentId) => request(`/activities/${activityId}/sessions/${studentId}`),
    createSession: (activityId, studentId) => request(`/activities/${activityId}/sessions`, { method: 'POST', body: json({ studentId }) }),
    sendMessage: (activityId, studentId, content) => request(`/activities/${activityId}/sessions/${studentId}/messages`, { method: 'POST', body: json({ content }) }),
    endSession: (activityId, studentId) => request(`/activities/${activityId}/sessions/${studentId}/end`, { method: 'POST' }),
    getStats: () => request('/admin/stats'),
    getUsers: (role) => request(`/admin/users?role=${role}`)
};

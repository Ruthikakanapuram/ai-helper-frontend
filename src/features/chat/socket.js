import { create } from 'zustand';
export const useSocketStore = create(set => ({ status: 'disconnected', setStatus: (status) => set({ status }) }));
const subscribers = new Set();
let socket = null;
let reconnect = null;
let attempts = 0;
let refs = 0;
let alive = false;
const url = () => import.meta.env.VITE_USE_MOCKS === 'false' ? (import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws/activities') : 'ws://localhost:12345/activity';
function connect() { if (!alive || socket && socket.readyState < 2)
    return; useSocketStore.getState().setStatus('connecting'); try {
    const ws = new WebSocket(url());
    socket = ws;
    ws.onopen = () => { attempts = 0; useSocketStore.getState().setStatus('connected'); };
    ws.onmessage = event => { try {
        const parsed = JSON.parse(String(event.data));
        if (['message.created', 'session.started', 'session.ended', 'activity.started', 'activity.stopped'].includes(parsed.type))
            subscribers.forEach(fn => fn(parsed));
    }
    catch { /* malformed event */ } };
    ws.onclose = () => { if (socket === ws)
        socket = null; useSocketStore.getState().setStatus('disconnected'); if (alive) {
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5));
        reconnect = setTimeout(connect, delay);
    } };
    ws.onerror = () => ws.close();
}
catch {
    useSocketStore.getState().setStatus('disconnected');
    reconnect = setTimeout(connect, 3000);
} }
export function subscribeSocket(callback) { subscribers.add(callback); refs++; alive = true; connect(); return () => { subscribers.delete(callback); refs--; if (refs <= 0) {
    alive = false;
    if (reconnect)
        clearTimeout(reconnect);
    socket?.close();
    socket = null;
    useSocketStore.getState().setStatus('disconnected');
} }; }

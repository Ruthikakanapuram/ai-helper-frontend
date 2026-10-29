import { useEffect, useRef } from 'react';
import { subscribeSocket, useSocketStore } from './socket';
export function useActivitySocket(activityId, callback) { const handler = useRef(callback); handler.current = callback; useEffect(() => subscribeSocket(e => { if (e.activityId === activityId)
    handler.current(e); }), [activityId]); return useSocketStore(s => s.status); }

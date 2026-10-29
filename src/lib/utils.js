import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...values) => twMerge(clsx(values));
export const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export function remaining(start, duration, now = Date.now()) { if (!start)
    return duration * 60; return Math.max(0, Math.ceil((new Date(start).getTime() + duration * 60_000 - now) / 1000)); }
export const mmss = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

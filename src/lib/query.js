import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000, refetchOnWindowFocus: false } } });
export const keys = { activities: ['activities'], activity: (id) => ['activities', id], students: (branch = '', year = '', section = '') => ['students', branch, year, section], session: (a, s) => ['session', a, s], transcript: (a, s) => ['transcript', a, s], stats: ['admin', 'stats'], users: (role) => ['admin', 'users', role] };
export async function refreshActivity(id) { await Promise.all([queryClient.invalidateQueries({ queryKey: keys.activities }), queryClient.invalidateQueries({ queryKey: keys.activity(id) }), queryClient.invalidateQueries({ queryKey: keys.stats })]); }

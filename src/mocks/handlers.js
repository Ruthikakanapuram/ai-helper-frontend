import { http, HttpResponse, delay } from 'msw';
import { db } from './seed';
import { emit } from './ws';

const ok = (value) => HttpResponse.json(value);
const fail = (msg, status = 400) => HttpResponse.json({ message: msg }, { status });
const findActivity = (id) => db.activities.find(a => a.id === id);
const getSession = (a, s) => db.sessions.find(x => x.activityId === a && x.studentId === s);
const makeId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};
function stopped(a) { return a.status === 'STOPPED' || (a.status === 'ACTIVE' && !!a.startedAt && Date.now() >= new Date(a.startedAt).getTime() + a.duration * 60000); }
const answer = (content) => `That's an important question. Here's a practical way to think about it:\n\n**${content.slice(0, 70)}${content.length > 70 ? '…' : ''}**\n\n1. **Understand the situation:** look for reliable, age-appropriate information.\n2. **Think critically:** consider safety, privacy, and possible consequences.\n3. **Take action safely:** when in doubt, talk with a trusted teacher or adult.\n\nWhat part would you like to explore next?`;
export const handlers = [
    http.post('/api/auth/login', async ({ request }) => { await delay(220); const b = await request.json(); const user = db.users.find(u => u.username.toLowerCase() === b.username.toLowerCase()); return user && b.password === 'password123' ? ok(user) : fail('Incorrect username or password', 401); }),
    http.get('/api/activities', () => ok(db.activities)),
    http.get('/api/activities/:id', ({ params }) => { const a = findActivity(String(params.id)); return a ? ok(a) : fail('Activity not found', 404); }),
    http.post('/api/activities', async ({ request }) => { await delay(400); const b = await request.json(); if (!b.name || !b.topic || !b.studentIds?.length)
        return fail('Missing required fields'); const a = { ...b, id: makeId(), status: 'DRAFT', createdAt: new Date().toISOString(), teacherId: 't1' }; db.activities.unshift(a); return ok(a); }),
    http.post('/api/activities/:id/start', ({ params }) => { const a = findActivity(String(params.id)); if (!a)
        return fail('Not found', 404); if (a.status !== 'DRAFT')
        return fail('Only draft activities can start', 409); a.status = 'ACTIVE'; a.startedAt = new Date().toISOString(); emit({ type: 'activity.started', activityId: a.id, payload: a }); return ok(a); }),
    http.post('/api/activities/:id/stop', ({ params }) => { const a = findActivity(String(params.id)); if (!a)
        return fail('Not found', 404); if (a.status !== 'ACTIVE')
        return fail('Only active activities can stop', 409); a.status = 'STOPPED'; a.stoppedAt = new Date().toISOString(); emit({ type: 'activity.stopped', activityId: a.id, payload: a }); return ok(a); }),
    http.get('/api/students', ({ request }) => { const q = new URL(request.url).searchParams; return ok(db.students.filter(s => (!q.get('branch') || s.branch === q.get('branch')) && (!q.get('year') || String(s.year) === q.get('year')) && (!q.get('section') || s.section === q.get('section')))); }),
    http.get('/api/activities/:a/sessions/:s', ({ params }) => { const a = String(params.a), s = String(params.s); return ok({ session: getSession(a, s) || null, messages: db.messages.filter(m => m.activityId === a && m.studentId === s) }); }),
    http.post('/api/activities/:a/sessions', async ({ params, request }) => { const a = findActivity(String(params.a)); const { studentId } = await request.json(); if (!a || !a.studentIds.includes(studentId))
        return fail('Not assigned', 403); if (a.status !== 'ACTIVE' || stopped(a))
        return fail('Activity is not live', 409); const existing = getSession(a.id, studentId); if (existing)
        return ok(existing); const s = { id: makeId(), activityId: a.id, studentId, status: 'IN_PROGRESS', startedAt: new Date().toISOString() }; db.sessions.push(s); emit({ type: 'session.started', activityId: a.id, payload: s }); return ok(s); }),
    http.post('/api/activities/:a/sessions/:s/messages', async ({ params, request }) => { const a = findActivity(String(params.a)), s = String(params.s); const { content } = await request.json(); const session = getSession(String(params.a), s); if (!a || !session || session.status !== 'IN_PROGRESS' || a.status !== 'ACTIVE' || stopped(a))
        return fail('Session has ended', 409); if (!content.trim())
        return fail('Empty prompt'); const msg = { id: makeId(), sessionId: session.id, studentId: s, activityId: a.id, role: 'user', content: content.trim(), createdAt: new Date().toISOString() }; db.messages.push(msg); emit({ type: 'message.created', activityId: a.id, payload: msg }); setTimeout(() => { if (a.status !== 'ACTIVE' || stopped(a) || session.status !== 'IN_PROGRESS')
        return; const reply = { ...msg, id: makeId(), role: 'assistant', content: answer(content), createdAt: new Date().toISOString() }; db.messages.push(reply); emit({ type: 'message.created', activityId: a.id, payload: reply }); }, 700 + Math.floor(Math.random() * 500)); return ok(msg); }),
    http.post('/api/activities/:a/sessions/:s/end', ({ params }) => { const session = getSession(String(params.a), String(params.s)); if (!session)
        return fail('Session not found', 404); session.status = 'COMPLETED'; session.endedAt = new Date().toISOString(); emit({ type: 'session.ended', activityId: session.activityId, payload: session }); return ok(session); }),
    http.get('/api/admin/stats', () => ok({ teachers: db.users.filter(u => u.role === 'TEACHER').length, students: db.students.length, activities: db.activities.length })),
    http.get('/api/admin/users', ({ request }) => { const role = new URL(request.url).searchParams.get('role'); return ok(db.users.filter(u => u.role === role)); })
];

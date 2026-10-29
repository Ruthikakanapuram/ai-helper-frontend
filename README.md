# AI Helper — Frontend

A complete React 18 + JavaScript education application for **Teacher**, **Student**, and **Admin** roles. The frontend runs standalone with MSW REST mocks and a simulated WebSocket server.

## Start

```bash
npm install
npm run dev
```

Open http://localhost:5173. Vite starts the MSW worker automatically (`VITE_USE_MOCKS` defaults to enabled). The install script generates the MSW service worker in `public/` automatically. Run `npm run build` for a production build.

**Demo credentials** (all use `password123`): `teacher`, `teacher2`, `student` (first student), `student2` … `student60`, and `admin`. Choose demo role on the login screen. All students are assigned to one or more activities except some by design. In-memory data resets with a browser reload or dev-server restart (depending on worker state).

## Configuration

Copy `.env.example` to `.env.local` and set:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_USE_MOCKS` | `true` (unless explicitly `false`) | Enable MSW and mocked socket server |
| `VITE_API_URL` | `http://localhost:3000/api` | Real NestJS API root when mocks disabled |
| `VITE_WS_URL` | `ws://localhost:3000/ws/activities` | Real WebSocket endpoint when mocks disabled |

## Switch to NestJS

Set `VITE_USE_MOCKS=false`. The public API facade is `src/lib/api.js`. Map its paths to the NestJS controller routes without changing page components. Add bearer token injection and real refresh-token handling in `request()` for production. The demo login intentionally uses simple localStorage and must be replaced with secure server-issued authentication. Apply access-control rules on the server as well as UI guards. Configure CORS to allow the Vite origin.

## WebSocket event contract

Use JSON objects with discriminated `type` and `activityId` keys, and a structured `payload`:

```
{ "type":"message.created", "activityId":"a1", "payload": Message }
{ "type":"session.started", "activityId":"a1", "payload": Session }
{ "type":"session.ended", "activityId":"a1", "payload": Session }
{ "type":"activity.started", "activityId":"a1", "payload": Activity }
{ "type":"activity.stopped", "activityId":"a1", "payload": Activity }
```

Runtime validation schemas are in `src/lib/schemas.js`. `useActivitySocket` filters activity events and uses a shared native-WebSocket connection with exponential reconnect. Mock mode uses `mock-socket` to provide an in-browser WebSocket server. An assistant response is emitted approximately 0.7–1.2 seconds after each submitted prompt. TanStack Query invalidation and cache updates keep the student and teacher experiences synchronized in the same browser tab. To test multi-tab live updates against a real server, use a shared backend WebSocket broker; the browser mock is intentionally per-tab.

## Pages

- `/login`: demo role chooser + validated login
- `/teacher/activities`: searchable-in-code teacher activity list, start/stop/view
- `/teacher/activities/new`: TanStack Form + Zod, cascading branch/year/section selection, cross-filter preserved selection, duration choices
- `/teacher/activities/$activityId`: live countdown, teacher controls, accordion with per-student message history
- `/student`: assigned activity cards with status-driven entry/history actions
- `/student/activities/$activityId`: chat history, first-entry session creation, Markdown, typing, done confirmation, read-only ended sessions
- `/admin`: role counts, searchable and paginated teacher/student/activity tables

## Structure

`src/routes` — TanStack Router tree, guards and page entrypoints; `src/features` — activity, auth, chat features; `src/components/ui` — reusable design primitives; `src/lib` — API, query keys, validation, helpers; `src/mocks` — MSW handlers, seed data, mocked WS; the event contracts are documented above.

## Security & deployment notes

Mocks do **not** implement authorization. Deploy with HTTPS/WSS, server-controlled time expiry, authenticated socket subscriptions, rate limiting, output moderation, audit logging, and secure session cookies/token refresh. HTML from Markdown is filtered with a conservative DOM-based sanitizer for the demo; production deployments should use a hardened audited HTML sanitizer (e.g. DOMPurify) with an explicit policy. For a student-facing application covering sensitive topics, implement age-appropriate safeguards and an escalation flow in the NestJS service.

## JSX-only source
All React components/pages are `.jsx` files. Other modules use `.js`. No TypeScript source or build tooling is required. WebSocket event shapes are documented in this README and runtime schemas can be extended with Zod.

## Role-based page structure

- `src/routes/teacher/index.jsx`: activity list
- `src/routes/teacher/create-activity.jsx`: create and assign students
- `src/routes/teacher/live-monitor.jsx`: live monitor
- `src/routes/student/index.jsx`: assigned activities
- `src/routes/student/chat-session.jsx`: student chat
- `src/routes/admin/index.jsx`: admin dashboard

Shared domain utilities remain under `src/features/` and `src/lib/`.

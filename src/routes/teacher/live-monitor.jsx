import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Link, useParams } from '@tanstack/react-router';

import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
} from '@tanstack/react-query';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useActivitySse } from '../../features/chat/useActivitySse';
import {
  ArrowDown,
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  ListOrdered,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Radio,
  RefreshCw,
  Search,
  Square,
  UserRound,
} from 'lucide-react';

import { toast } from 'sonner';

import { api } from '../../lib/api';

import {
  keys,
  queryClient,
  refreshActivity,
} from '../../lib/query';

// import { useActivitySocket } from '../../features/chat/useActivitySocket';

import { remaining, mmss } from '../../lib/utils';

import {
  Button,
  ErrorState,
  Loading,
  Spinner,
} from '../../components/ui';

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------

function formatTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDay(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getActivityTitle(activity) {
  return activity?.title ?? activity?.name ?? 'Activity';
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
];

function avatarColor(seed) {
  let hash = 0;

  for (const char of String(seed ?? '')) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  const first = parts[0]?.[0] || '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';

  return (first + last).toUpperCase();
}

function Avatar({ student, size = 'md' }) {
  const dimension = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dimension} ${avatarColor(student.studentId ?? student.name)}`}
    >
      {initials(student.name)}
    </div>
  );
}

// ------------------------------------------------------
// Activity header
// ------------------------------------------------------

function Chip({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900">
      <Icon size={14} className="text-slate-400" />
      <span className="text-slate-500">{label}</span>
      {children}
    </div>
  );
}

// "Published" is shown as "Live" while the activity is running.
function ActivityStatus({ status }) {
  if (['PUBLISHED', 'ACTIVE'].includes(status)) {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    );
  }

  const label =
    {
      CLOSED: 'Closed',
      STOPPED: 'Closed',
      DRAFT: 'Draft',
      SCHEDULED: 'Scheduled',
      ARCHIVED: 'Archived',
    }[status] || status;

  return (
    <span className="font-semibold text-slate-800 dark:text-slate-200">
      {label}
    </span>
  );
}

function ActivityHeader({
  activity,
  seconds,
  ended,
  onStart,
  onStop,
  isStarting,
  isStopping,
}) {
  const status = ended ? 'CLOSED' : activity.status;

  const canStart = ['SCHEDULED', 'DRAFT'].includes(activity.status);
  const isRunning = ['PUBLISHED', 'ACTIVE'].includes(activity.status) && !ended;
  const canStop = isRunning;

  const timeTone =
    seconds <= 60
      ? 'text-red-600 dark:text-red-400'
      : seconds <= 300
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-800 dark:text-slate-200';

  // Start time, and end time (actual if the API provides it, otherwise
  // start time + duration).
  const startedAt = activity.startedAt ? new Date(activity.startedAt) : null;
  const endedRaw = activity.endedAt ?? activity.stoppedAt ?? activity.closedAt;

  const endedAt = endedRaw
    ? new Date(endedRaw)
    : startedAt && activity.duration
      ? new Date(startedAt.getTime() + activity.duration * 60000)
      : null;

  const startedLabel = formatDateTime(startedAt);
  const endedLabel = formatDateTime(endedAt);

  return (
    <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 md:px-6">

        {/* Title */}

        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/teacher/activities"
            aria-label="Back to activities"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft size={17} />
          </Link>

          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100 md:text-lg">
              {getActivityTitle(activity)}
            </h1>

            <p className="mt-0.5 max-w-[60ch] truncate text-xs text-slate-500">
              {activity.topic || 'Activity monitoring'}
              {activity.description ? ` · ${activity.description}` : ''}
            </p>
          </div>
        </div>

        {/* Status, students + controls */}

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <Chip icon={Radio} label="Status">
            <ActivityStatus status={status} />
          </Chip>

          {!ended && (
            <Chip icon={Clock} label="Time left">
              <span
                className={`font-semibold tabular-nums ${
                  isRunning ? timeTone : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {mmss(
                  ['SCHEDULED', 'DRAFT'].includes(activity.status)
                    ? (activity.duration || 0) * 60
                    : seconds,
                )}
              </span>
            </Chip>
          )}

          {startedLabel && (
            <Chip icon={Clock} label="Started">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {startedLabel}
              </span>
            </Chip>
          )}

          {endedLabel && (ended || isRunning) && (
            <Chip icon={Clock} label={ended ? 'Ended' : 'Ends'}>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {endedLabel}
              </span>
            </Chip>
          )}

          {canStart && (
            <Button onClick={onStart} disabled={isStarting || isStopping}>
              {isStarting ? <Spinner /> : <Play size={14} />}
              Start
            </Button>
          )}

          {canStop && (
            <AlertDialog.Root>
              <AlertDialog.Trigger asChild>
                <Button variant="danger" disabled={isStopping || isStarting}>
                  <Square size={14} />
                  Stop
                </Button>
              </AlertDialog.Trigger>

              <AlertDialog.Portal>
                <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />

                <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                  <AlertDialog.Title className="text-lg font-semibold">
                    Stop this activity?
                  </AlertDialog.Title>

                  <AlertDialog.Description className="my-3 text-sm text-slate-500">
                    Students will no longer be able to continue this
                    activity. Existing conversations will remain available
                    for review.
                  </AlertDialog.Description>

                  <div className="flex justify-end gap-2">
                    <AlertDialog.Cancel asChild>
                      <Button variant="outline">Cancel</Button>
                    </AlertDialog.Cancel>

                    <AlertDialog.Action asChild>
                      <Button
                        variant="danger"
                        onClick={onStop}
                        disabled={isStopping}
                      >
                        {isStopping ? <Spinner /> : null}
                        Stop activity
                      </Button>
                    </AlertDialog.Action>
                  </div>
                </AlertDialog.Content>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          )}
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------------------
// Sidebar layout: drag to resize + collapse
// ------------------------------------------------------

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 320;
const SIDEBAR_RAIL = 72;
const SIDEBAR_STORAGE_KEY = 'teacher-monitor-sidebar';

function clampWidth(value) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

function readSidebarPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY) || 'null');

    if (saved) {
      return {
        width: clampWidth(Number(saved.width) || SIDEBAR_DEFAULT),
        collapsed: Boolean(saved.collapsed),
      };
    }
  } catch {
    // ignore storage errors
  }

  return { width: SIDEBAR_DEFAULT, collapsed: false };
}

function useSidebarLayout() {
  const [prefs, setPrefs] = useState(readSidebarPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore storage errors
    }
  }, [prefs]);

  const setWidth = useCallback(
    (width) => setPrefs((p) => ({ ...p, width: clampWidth(width) })),
    [],
  );

  const toggleCollapsed = useCallback(
    () => setPrefs((p) => ({ ...p, collapsed: !p.collapsed })),
    [],
  );

  return {
    width: prefs.width,
    collapsed: prefs.collapsed,
    setWidth,
    toggleCollapsed,
  };
}

// Resizing/collapsing only applies side-by-side (md and up).
function useIsDesktop() {
  const query = '(min-width: 768px)';

  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(media.matches);
    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
}

function SidebarResizer({ width, onResize, onReset }) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, width: 0 });

  // Keep the cursor and text selection sane while dragging.
  useEffect(() => {
    if (!dragging) return undefined;

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [dragging]);

  const onPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
    setDragging(true);
  };

  const onPointerMove = (event) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onResize(start.current.width + (event.clientX - start.current.x));
  };

  const endDrag = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragging(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onResize(width - 16);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onResize(width + 16);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize student list"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className="group relative z-10 -ml-1 hidden w-2 shrink-0 cursor-col-resize touch-none select-none outline-none md:block"
    >
      <span
        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
          dragging
            ? 'w-0.5 bg-blue-500'
            : 'w-px bg-transparent group-hover:w-0.5 group-hover:bg-blue-400 group-focus-visible:w-0.5 group-focus-visible:bg-blue-500'
        }`}
      />
    </div>
  );
}

// ------------------------------------------------------
// Student sidebar
// ------------------------------------------------------

// How many students are listed before the "+ N more" row.
const VISIBLE_LIMIT = 5;

function StudentSidebar({
  students,
  stats,
  selectedStudentId,
  onSelect,
  width,
  collapsed: panelCollapsed,
  isDesktop,
  onToggleCollapsed,
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return students;

    return students.filter(
      (student) =>
        String(student.name || '').toLowerCase().includes(term) ||
        String(student.rollNumber || '').toLowerCase().includes(term),
    );
  }, [students, query]);

  // Collapse long lists to the first few students; searching always shows
  // every match, and the selected student is never hidden.
  const isSearching = query.trim().length > 0;
  const collapsed = !expanded && !isSearching && visible.length > VISIBLE_LIMIT;

  const shown = useMemo(() => {
    if (!collapsed) return visible;

    const head = visible.slice(0, VISIBLE_LIMIT);
    const selected = visible.find(
      (s) => String(s.studentId) === String(selectedStudentId),
    );

    if (selected && !head.includes(selected)) head.push(selected);

    return head;
  }, [collapsed, visible, selectedStudentId]);

  const hiddenCount = visible.length - shown.length;

  // Collapsed: a narrow rail with just the avatars.
  if (isDesktop && panelCollapsed) {
    return (
      <aside
        style={{ width: SIDEBAR_RAIL }}
        className="flex min-h-0 shrink-0 flex-col items-center border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand student list"
          title="Expand student list"
          className="my-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <PanelLeftOpen size={18} />
        </button>

        <div className="min-h-0 w-full flex-1 overflow-y-auto pb-3">
          <div className="flex flex-col items-center gap-2">
            {students.map((student) => {
              const selected =
                String(selectedStudentId) === String(student.studentId);

              return (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => onSelect(student.studentId)}
                  aria-current={selected}
                  title={`${student.name} · ${student.rollNumber}`}
                  className={`rounded-full p-0.5 transition ${
                    selected
                      ? 'ring-2 ring-blue-600'
                      : 'hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-700'
                  }`}
                >
                  <Avatar student={student} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={isDesktop ? { width } : undefined}
      className="flex max-h-[38vh] min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:max-h-none md:border-b-0 md:border-r"
    >

      {/* Heading and search */}

      <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Students{' '}
            <span className="font-normal text-slate-500">
              ({students.length})
            </span>
          </h2>

          <div className="flex items-center gap-1.5">
            {isDesktop && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label="Collapse student list"
                title="Collapse student list"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or roll number"
            aria-label="Search students"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:focus:bg-slate-900"
          />
        </div>
      </div>

      {/* List: only this section scrolls */}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((student) => {
          const selected =
            String(selectedStudentId) === String(student.studentId);

          // Counted on the client from the student's chat history.
          const stat = stats?.[String(student.studentId)];
          const promptCount = stat?.count ?? 0;
          const promptLabel = `${promptCount}${stat?.hasMore ? '+' : ''}`;
          const lastTime = stat?.lastAt || student.lastMessageAt;

          return (
            <button
              key={student.studentId}
              type="button"
              onClick={() => onSelect(student.studentId)}
              aria-current={selected}
              className={`flex w-full items-center gap-3 border-b border-l-[3px] border-b-slate-100 px-3 py-3 text-left transition dark:border-b-slate-900 ${
                selected
                  ? 'border-l-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                  : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <Avatar student={student} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {student.name}
                </p>

                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {student.rollNumber}
                </p>

                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <MessageSquare size={11} />
                  {promptLabel} {promptCount === 1 && !stat?.hasMore ? 'prompt' : 'prompts'}
                </p>
              </div>

              <span className="shrink-0 self-start pt-1 text-right text-[11px] leading-tight text-slate-400">
                {lastTime ? (
                  <>
                    <span className="block text-[10px]">Last msg</span>
                    {formatTime(lastTime)}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </button>
          );
        })}

        {collapsed && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex w-full items-center gap-3 border-b border-l-[3px] border-b-slate-100 border-l-transparent px-3 py-3 text-left transition hover:bg-slate-50 dark:border-b-slate-900 dark:hover:bg-slate-900"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
              <ChevronDown size={18} />
            </span>

            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              + {hiddenCount} more
            </span>

            <span className="ml-auto text-xs text-blue-600 dark:text-blue-400">
              Show all
            </span>
          </button>
        )}

        {expanded && !isSearching && visible.length > VISIBLE_LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex w-full items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium text-blue-600 transition hover:bg-slate-50 dark:text-blue-400 dark:hover:bg-slate-900"
          >
            <ChevronUp size={14} />
            Show less
          </button>
        )}

        {visible.length === 0 && (
          <div className="p-8 text-center">
            <UserRound size={26} className="mx-auto mb-2 text-slate-300" />

            <p className="text-sm text-slate-500">
              {students.length === 0
                ? 'No students assigned.'
                : 'No students match your search.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

// ------------------------------------------------------
// Chat header
// ------------------------------------------------------

function ChatHeader({
  student,
  onRefresh,
  isRefreshing,
  promptCount,
  outlineOpen,
  onToggleOutline,
}) {
  const details = [
    student.rollNumber,
    student.branch,
    student.year ? `Year ${student.year}` : null,
    student.section ? `Sec ${student.section}` : null,
  ].filter(Boolean);

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar student={student} size="sm" />

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
            {student.name}
          </h2>

          <p className="truncate text-xs text-slate-400">
            {details.join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onToggleOutline && (
          <button
            type="button"
            onClick={onToggleOutline}
            data-outline-toggle
            aria-expanded={outlineOpen}
            title="Jump to a prompt"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${
              outlineOpen
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <ListOrdered size={15} />
            Prompts ({promptCount})
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh conversation"
            title="Refresh conversation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? 'animate-spin' : ''}
            />
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------
// Chat message
// ------------------------------------------------------

function DaySeparator({ label }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />

      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {label}
      </span>

      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${index * 150}ms` }}
        />
      ))}
    </span>
  );
}

function ChatMessage({ message, student }) {
  return (
    <div className="space-y-3">

      {/* Student prompt */}

      <div className="flex items-end justify-end gap-2">
        <div className="max-w-[85%] md:max-w-[72%]">
          <div className="rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-6 text-white shadow-sm">
            <p className="whitespace-pre-wrap break-words">
              {message.prompt}
            </p>
          </div>

          <p className="mt-1 text-right text-[10px] text-slate-400">
            {formatTime(message.createdAt)}
          </p>
        </div>

        <div className="mb-5 hidden sm:block">
          <Avatar student={student} size="sm" />
        </div>
      </div>

      {/* AI response */}

      <div className="flex items-end gap-2">
        <div className="mb-5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 sm:flex">
          <Bot size={16} />
        </div>

        <div className="max-w-[85%] md:max-w-[78%]">
          {message.response ? (
            <>
              <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <p className="mb-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  AI Assistant
                </p>

                <p className="whitespace-pre-wrap break-words">
                  {message.response}
                </p>
              </div>

              <p className="mt-1 text-[10px] text-slate-400">
                {formatTime(message.completedAt)}
              </p>
            </>
          ) : (
            <div
              className={`inline-flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2.5 text-xs ${
                message.status === 'FAILED'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {message.status === 'FAILED' ? (
                'AI response failed'
              ) : (
                <>
                  <TypingDots />
                  <span>AI is responding</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------
// Chat panel
// ------------------------------------------------------

function ChatPanel({ student }) {
  const scrollRef = useRef(null);
  const previousScrollHeight = useRef(null);
  const previousScrollTop = useRef(null);
  const initialScrollDone = useRef(false);
  const nearBottom = useRef(true);

  const [showJump, setShowJump] = useState(false);
  const [showOutline, setShowOutline] = useState(false);

  const sessionId = student?.sessionId;

  const historyQuery = useInfiniteQuery({
    queryKey: ['activity-monitor-chat', String(sessionId)],

    enabled: Boolean(sessionId),

    initialPageParam: undefined,

    queryFn: ({ pageParam }) =>
      api.getSessionChatHistory(sessionId, {
        limit: 30,
        beforeId: pageParam,
      }),

    getPreviousPageParam: (firstPage) => {
      if (!firstPage.pagination?.hasMore) {
        return undefined;
      }

      return firstPage.pagination.nextCursor;
    },

    getNextPageParam: () => undefined,
  });

  const messages = useMemo(
    () =>
      (historyQuery.data?.pages || []).flatMap(
        (page) => page.messages || [],
      ),
    [historyQuery.data],
  );

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const element = scrollRef.current;

    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior });
    }
  }, []);

  // Scroll to the latest messages after the initial load.
  useEffect(() => {
    if (!sessionId || !historyQuery.isSuccess || initialScrollDone.current) {
      return;
    }

    scrollToBottom('auto');
    initialScrollDone.current = true;
  }, [sessionId, historyQuery.isSuccess, scrollToBottom]);

  // Follow new messages / streaming responses, but only when the
  // teacher is already near the bottom (don't yank them away from history).
  const lastMessage = messages[messages.length - 1];

  const lastKey = lastMessage
    ? `${lastMessage.id}:${lastMessage.status}:${lastMessage.response?.length || 0}`
    : '';

  useEffect(() => {
    if (initialScrollDone.current && nearBottom.current) {
      scrollToBottom('smooth');
    }
  }, [lastKey, scrollToBottom]);

  // Preserve the visible position when older messages are added.
  useLayoutEffect(() => {
    const element = scrollRef.current;

    if (!element || previousScrollHeight.current === null) {
      return;
    }

    const heightDifference =
      element.scrollHeight - previousScrollHeight.current;

    element.scrollTop = previousScrollTop.current + heightDifference;

    previousScrollHeight.current = null;
    previousScrollTop.current = null;
  }, [messages.length]);

  useEffect(() => {
    initialScrollDone.current = false;
    previousScrollHeight.current = null;
    previousScrollTop.current = null;
    nearBottom.current = true;
  }, [sessionId]);

  const loadOlderMessages = useCallback(async () => {
    const element = scrollRef.current;

    if (
      !element ||
      !historyQuery.hasPreviousPage ||
      historyQuery.isFetchingPreviousPage
    ) {
      return;
    }

    previousScrollHeight.current = element.scrollHeight;
    previousScrollTop.current = element.scrollTop;

    try {
      await historyQuery.fetchPreviousPage();
    } catch {
      previousScrollHeight.current = null;
      previousScrollTop.current = null;
    }
  }, [
    historyQuery.hasPreviousPage,
    historyQuery.isFetchingPreviousPage,
    historyQuery.fetchPreviousPage,
  ]);

  // Close the prompt list when clicking anywhere else, or pressing Escape.
  useEffect(() => {
    if (!showOutline) return undefined;

    const onPointerDown = (event) => {
      if (
        event.target.closest?.('[data-outline-panel]') ||
        event.target.closest?.('[data-outline-toggle]')
      ) {
        return;
      }

      setShowOutline(false);
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowOutline(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showOutline]);

  // Jump to a specific prompt in the conversation.
  const jumpToPrompt = useCallback((id) => {
    setShowOutline(false);

    const target = document.getElementById(`prompt-${id}`);

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleScroll = () => {
    const element = scrollRef.current;

    if (!element) return;

    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    nearBottom.current = distanceFromBottom < 120;
    setShowJump(distanceFromBottom > 300);

    if (element.scrollTop <= 50) {
      void loadOlderMessages();
    }
  };

  if (!student) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
            <MessageSquare size={26} />
          </div>

          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Select a student
          </h3>

          <p className="mt-1 text-xs text-slate-400">
            Choose a student to view their conversation.
          </p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
        <ChatHeader student={student} />

        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-900">
              <Clock size={26} />
            </div>

            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Waiting for student to start
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              {student.name} has not started this activity yet. Their
              conversation will appear here after they begin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-slate-50/70 dark:bg-slate-950">

      <ChatHeader
        student={student}
        onRefresh={() => void historyQuery.refetch()}
        isRefreshing={historyQuery.isFetching && !historyQuery.isLoading}
        promptCount={`${messages.length}${historyQuery.hasPreviousPage ? '+' : ''}`}
        outlineOpen={showOutline}
        onToggleOutline={() => setShowOutline((open) => !open)}
      />

      {/* Prompt outline: click a prompt to jump to it */}

      {showOutline && (
        <div data-outline-panel className="absolute right-4 top-14 z-20 flex max-h-[60vh] w-80 max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="shrink-0 border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
            Prompts
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {historyQuery.hasPreviousPage && (
              <button
                type="button"
                onClick={() => void loadOlderMessages()}
                disabled={historyQuery.isFetchingPreviousPage}
                className="w-full border-b border-slate-100 px-3 py-2 text-left text-xs font-medium text-blue-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-slate-800"
              >
                {historyQuery.isFetchingPreviousPage
                  ? 'Loading...'
                  : 'Load earlier prompts'}
              </button>
            )}

            {messages.map((message, index) => (
              <button
                key={message.id}
                type="button"
                onClick={() => jumpToPrompt(message.id)}
                className="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                <span className="mt-0.5 w-5 shrink-0 text-slate-400">
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 break-words text-slate-700 dark:text-slate-200">
                    {message.prompt}
                  </span>

                  <span className="mt-0.5 block text-[10px] text-slate-400">
                    {formatTime(message.createdAt)}
                  </span>
                </span>
              </button>
            ))}

            {messages.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                No prompts yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* Only the conversation area scrolls */}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 md:px-8 md:py-6"
      >
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {historyQuery.isLoading && (
            <div className="py-8">
              <Loading rows={3} />
            </div>
          )}

          {historyQuery.isError && (
            <div className="mx-auto max-w-lg rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              Could not load this conversation.

              <button
                type="button"
                onClick={() => void historyQuery.refetch()}
                className="ml-2 font-semibold underline"
              >
                Retry
              </button>
            </div>
          )}

          {historyQuery.isFetchingPreviousPage && (
            <p className="py-2 text-center text-xs text-slate-400">
              Loading older messages...
            </p>
          )}

          {messages.map((message, index) => {
            const day = formatDay(message.createdAt);
            const previousDay =
              index > 0 ? formatDay(messages[index - 1].createdAt) : null;

            return (
              <Fragment key={message.id}>
                {day && day !== previousDay && <DaySeparator label={day} />}

                <div id={`prompt-${message.id}`} className="scroll-mt-4">
                  <ChatMessage message={message} student={student} />
                </div>
              </Fragment>
            );
          })}

          {!historyQuery.isLoading &&
            !historyQuery.isError &&
            messages.length === 0 && (
              <div className="py-12 text-center">
                <MessageSquare
                  size={30}
                  className="mx-auto mb-3 text-slate-300"
                />

                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  No messages yet
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  This student hasn't sent a message yet.
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Jump to latest */}

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-5 right-6 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-lg transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowDown size={14} />
          Latest
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------
// Main teacher monitoring page
// ------------------------------------------------------

export function TeacherMonitor() {
  const { activityId } = useParams({
    from: '/teacher/activities/$activityId',
  });

  const [now, setNow] = useState(Date.now());
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  useEffect(() => {
    document.body.classList.add('teacher-monitor-page');

    return () => {
      document.body.classList.remove('teacher-monitor-page');
    };
  }, []);

  const isDesktop = useIsDesktop();
  const sidebar = useSidebarLayout();

  // Activity details.
  const activityQuery = useQuery({
    queryKey: keys.activity(activityId),
    queryFn: () => api.getActivity(activityId),
  });

  // All assigned students, including students who have not started.
  const monitorQuery = useQuery({
    queryKey: ['activity-monitor', String(activityId)],
    queryFn: () => api.getActivityMonitor(activityId),
  });

  const activity = activityQuery.data;
  const students = monitorQuery.data?.students || [];

  // The clock only ticks while the activity is live, so it stops the moment
  // the teacher stops (or the activity closes). It is still needed to detect
  // when the activity's duration has run out.
  const isLive = ['PUBLISHED', 'ACTIVE'].includes(activity?.status);

  useEffect(() => {
    if (!isLive) return undefined;

    setNow(Date.now());

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isLive]);

  // Automatically select the first student.
  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId(null);
      return;
    }

    const selectedStillExists = students.some(
      (student) => String(student.studentId) === String(selectedStudentId),
    );

    if (!selectedStillExists) {
      setSelectedStudentId(String(students[0].studentId));
    }
  }, [students, selectedStudentId]);

  const selectedStudent =
    students.find(
      (student) => String(student.studentId) === String(selectedStudentId),
    ) || null;

  // Prompt count + last message time for every student, computed on the
  // client from each student's chat history (no backend change needed).
  const STATS_LIMIT = 200;

  const statsQueries = useQueries({
    queries: students
      .filter((student) => student.sessionId)
      .map((student) => ({
        queryKey: ['activity-monitor-stats', String(student.sessionId)],
        queryFn: () =>
          api.getSessionChatHistory(student.sessionId, { limit: STATS_LIMIT }),
        select: (data) => {
          const list = data?.messages || [];

          let lastAt = null;

          for (const message of list) {
            const time = new Date(message.createdAt).getTime();

            if (!Number.isNaN(time) && (lastAt === null || time > lastAt)) {
              lastAt = time;
            }
          }

          return {
            studentId: String(student.studentId),
            count: list.length,
            hasMore: Boolean(data?.pagination?.hasMore),
            lastAt: lastAt === null ? null : new Date(lastAt).toISOString(),
          };
        },
      })),
  });

  const stats = useMemo(() => {
    const map = {};

    for (const query of statsQueries) {
      if (query.data) map[query.data.studentId] = query.data;
    }

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsQueries.map((query) => query.dataUpdatedAt).join(',')]);

  const handleSseEvent = useCallback((event) => {
    const supportedEvents = [
      'prompt_submitted',
      'response_completed',
      'response_failed',
    ];

    if (!supportedEvents.includes(event.type)) return;

    // Refresh the student monitoring information.
    void queryClient.invalidateQueries({
      queryKey: ['activity-monitor', String(activityId)],
    });

    // Refresh the conversation associated with this event.
    if (event.sessionId) {
      void queryClient.invalidateQueries({
        queryKey: [
          'activity-monitor-chat',
          String(event.sessionId),
        ],
        exact: true,
      });

      // Refresh that student's prompt count / last message time.
      void queryClient.invalidateQueries({
        queryKey: ['activity-monitor-stats', String(event.sessionId)],
        exact: true,
      });
    } else {
      void queryClient.invalidateQueries({
        queryKey: ['activity-monitor-stats'],
      });
    }
  }, [activityId]);

  const handleSseReconnect = useCallback(() => {
    void monitorQuery.refetch();

    void queryClient.invalidateQueries({
      queryKey: ['activity-monitor-stats'],
    });

    if (selectedStudent?.sessionId) {
      void queryClient.invalidateQueries({
        queryKey: [
          'activity-monitor-chat',
          String(selectedStudent.sessionId),
        ],
        exact: true,
      });
    }
  }, [
    monitorQuery.refetch,
    selectedStudent?.sessionId,
  ]);

  // Socket events.
  const handleSocketEvent = useCallback(
    (event) => {
      if (
        event.type === 'activity.started' ||
        event.type === 'activity.stopped'
      ) {
        if (event.payload) {
          queryClient.setQueryData(keys.activity(activityId), event.payload);
        }

        void queryClient.invalidateQueries({
          queryKey: keys.activities,
        });

        void queryClient.invalidateQueries({
          queryKey: keys.activity(activityId),
        });
      }

      if (
        [
          'message.created',
          'session.started',
          'session.ended',
          'prompt_submitted',
          'response_completed',
          'response_failed',
        ].includes(event.type)
      ) {
        void queryClient.invalidateQueries({
          queryKey: ['activity-monitor', String(activityId)],
        });

        // Refresh the currently selected conversation.
        if (selectedStudent?.sessionId) {
          void queryClient.invalidateQueries({
            queryKey: [
              'activity-monitor-chat',
              String(selectedStudent.sessionId),
            ],
          });
        }

        // Also refresh the session identified by the event, if provided.
        if (event.sessionId) {
          void queryClient.invalidateQueries({
            queryKey: ['activity-monitor-chat', String(event.sessionId)],
          });
        }
      }
    },
    [activityId, selectedStudent?.sessionId],
  );

  // Keeps the live updates running (no connection indicator is shown).
  // useActivitySocket(activityId, handleSocketEvent);
  const connectionStatus = useActivitySse(
    activityId,
    handleSseEvent,
    handleSseReconnect,
  );

  // Start activity.
  const start = useMutation({
    mutationFn: () => api.startActivity(activityId),

    onSuccess: () => {
      void refreshActivity(activityId);

      void queryClient.invalidateQueries({
        queryKey: ['activity-monitor', String(activityId)],
      });

      toast.success('Activity started');
    },

    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Stop activity.
  const stop = useMutation({
    mutationFn: () => api.stopActivity(activityId),

    onSuccess: () => {
      void refreshActivity(activityId);

      void queryClient.invalidateQueries({
        queryKey: ['activity-monitor', String(activityId)],
      });

      toast.success('Activity ended');
    },

    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (activityQuery.isPending || monitorQuery.isPending) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loading rows={4} />
      </div>
    );
  }

  if (activityQuery.isError) {
    return (
      <ErrorState
        error={activityQuery.error}
        retry={() => void activityQuery.refetch()}
      />
    );
  }

  if (monitorQuery.isError) {
    return (
      <ErrorState
        error={monitorQuery.error}
        retry={() => void monitorQuery.refetch()}
      />
    );
  }

  if (!activity) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950">
        Activity not found.
      </div>
    );
  }

  const remainingSeconds = remaining(activity.startedAt, activity.duration, now);

  const ended =
    ['CLOSED', 'STOPPED'].includes(activity.status) ||
    (['PUBLISHED', 'ACTIVE'].includes(activity.status) && remainingSeconds === 0);

  const seconds = ended ? 0 : remainingSeconds;

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

      <ActivityHeader
        activity={{
          ...activity,
          studentCount: students.length,
        }}
        seconds={seconds}
        ended={ended}
        onStart={() => start.mutate()}
        onStop={() => stop.mutate()}
        isStarting={start.isPending}
        isStopping={stop.isPending}
      />

      {/* Stacks on mobile, side by side from md up */}

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">

        <StudentSidebar
          students={students}
          stats={stats}
          selectedStudentId={selectedStudentId}
          onSelect={(id) => setSelectedStudentId(String(id))}
          width={sidebar.width}
          collapsed={sidebar.collapsed}
          isDesktop={isDesktop}
          onToggleCollapsed={sidebar.toggleCollapsed}
        />

        {isDesktop && !sidebar.collapsed && (
          <SidebarResizer
            width={sidebar.width}
            onResize={sidebar.setWidth}
            onReset={() => sidebar.setWidth(SIDEBAR_DEFAULT)}
          />
        )}

        <ChatPanel
          key={selectedStudent?.studentId ?? 'no-student'}
          student={selectedStudent}
        />

      </main>
    </div>
  );
}

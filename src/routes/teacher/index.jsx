import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper, flexRender, getCoreRowModel,
  getSortedRowModel, getPaginationRowModel, useReactTable,
} from '@tanstack/react-table';
import {
  Plus, Play, Square, Clock, CalendarDays, Search,
  ArrowUpDown, ArrowUp, ArrowDown, CalendarClock, RadioTower,
  CircleCheck, Archive, ChevronRight, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { Button, Card, Empty, ErrorState, Loading, SectionHeading } from '../../components/ui';

const c = createColumnHelper();
const TIMEZONE = 'Asia/Kolkata';
const STATUSES = {
  SCHEDULED: { label: 'Scheduled', icon: CalendarClock, style: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900' },
  PUBLISHED: { label: 'Live', icon: RadioTower, style: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900' },
  CLOSED: { label: 'Stopped', icon: CircleCheck, style: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' },
  ARCHIVED: { label: 'Archived', icon: Archive, style: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-900' },
};
const STATUS_ORDER = { SCHEDULED: 0, PUBLISHED: 1, CLOSED: 2, ARCHIVED: 3 };

// Order inside "Today's Activities": live first, then scheduled, then finished.
const TODAY_ORDER = { PUBLISHED: 0, SCHEDULED: 1, CLOSED: 2, ARCHIVED: 3 };

// ScheduledDate is a date-only DB field. Never interpret YYYY-MM-DD as an instant.
function scheduledDay(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function formatDate(value) {
  const day = scheduledDay(value);
  if (!day) return '—';
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  }).format(date);
}

function StatusBadge({ status }) {
  const config = STATUSES[status];
  const Icon = config?.icon ?? Info;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${config?.style ?? 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      <Icon size={14} className={status === 'PUBLISHED' ? 'animate-pulse' : ''} />
      {config?.label ?? status ?? 'Unknown'}
    </span>
  );
}

function GreenStartButton({ activity, onStart, busy }) {
  return (
    <button type="button" disabled={busy} onClick={() => onStart(String(activity.id))}
      aria-label={`Start ${activity.title}`}
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
      <Play size={15} /> Start
    </button>
  );
}

function ActivityActions({ activity, onStart, onStop, busy }) {
  const navigate = useNavigate();
  const canStart = activity.status === 'SCHEDULED';
  const canStop = activity.status === 'PUBLISHED';
  const canView = ['PUBLISHED', 'CLOSED', 'ARCHIVED'].includes(activity.status);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canStart && <GreenStartButton activity={activity} onStart={onStart} busy={busy} />}
      {canStop && (
        <Button variant="danger" disabled={busy} onClick={() => {
          if (window.confirm('Stop this activity? All student chats will end.')) onStop(String(activity.id));
        }}><Square size={14} /> Stop</Button>
      )}
      {canView && (
        <button type="button"
          onClick={() => void navigate({ to: '/teacher/activities/$activityId', params: { activityId: String(activity.id) } })}
          aria-label={`View details for ${activity.title}`}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900">
          View <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function SortableHeader({ header }) {
  if (header.isPlaceholder) return null;
  const direction = header.column.getIsSorted();
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  const label = typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.id;
  return (
    <button type="button" onClick={header.column.getToggleSortingHandler()}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md py-1 text-left font-semibold transition hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:text-blue-400"
      aria-label={`Sort ${label}${direction ? `; currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}>
      {flexRender(header.column.columnDef.header, header.getContext())}
      <Icon size={14} className={direction ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
    </button>
  );
}

export function TeacherActivities() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState([{ id: 'scheduledDate', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [today, setToday] = useState(todayIST);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayIST()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const q = useQuery({
    queryKey: keys.activities, queryFn: api.getActivities,
    refetchOnWindowFocus: true, refetchInterval: 10_000,
  });
  const activities = useMemo(() => Array.isArray(q.data) ? q.data : [], [q.data]);

  async function refresh(activity) {
    await queryClient.invalidateQueries({ queryKey: keys.activities });
    if (activity?.id != null) {
      await queryClient.invalidateQueries({ queryKey: ['activity', String(activity.id)] });
    }
  }
  const start = useMutation({
    mutationFn: (id) => api.startActivity(id),
    onSuccess: (activity) => { void refresh(activity); toast.success('Activity started successfully'); },
    onError: (error) => toast.error(error?.message || 'Unable to start activity'),
  });
  const stop = useMutation({
    mutationFn: (id) => api.stopActivity(id),
    onSuccess: (activity) => { void refresh(activity); toast.success('Activity stopped successfully'); },
    onError: (error) => toast.error(error?.message || 'Unable to stop activity'),
  });
  const busy = start.isPending || stop.isPending;

  // Every activity scheduled for today, whatever its status
  // (live, scheduled, stopped, archived).
  const todayActivities = useMemo(() => activities
    .filter((activity) => scheduledDay(activity.scheduledDate) === today)
    .sort((a, b) => (TODAY_ORDER[a.status] ?? 99) - (TODAY_ORDER[b.status] ?? 99) || String(a.title ?? '').localeCompare(String(b.title ?? ''))),
  [activities, today]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activities;
    return activities.filter((activity) => [
      activity.title, activity.topic, activity.description, activity.duration,
      activity.status, STATUSES[activity.status]?.label,
      activity.scheduledDate, formatDate(activity.scheduledDate),
      formatDateTime(activity.createdAt), formatDateTime(activity.updatedAt),
      formatDateTime(activity.startedAt), formatDateTime(activity.endedAt),
    ].some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [activities, search]);

  const columns = useMemo(() => [
    c.accessor('title', {
      header: 'Activity', sortingFn: 'alphanumeric',
      cell: (info) => {
        const a = info.row.original;
        return (
          <div className="min-w-[175px] max-w-[340px] space-y-1">
            <p className="break-words font-semibold text-slate-900 dark:text-white">{a.title}</p>
            {a.startedAt && (
              <p className="flex flex-wrap gap-x-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400" title={formatDateTime(a.startedAt)}>
                <span className="font-medium text-slate-700 dark:text-slate-300">Started at:</span>
                <time dateTime={a.startedAt}>{formatDateTime(a.startedAt)}</time>
              </p>
            )}
            {a.endedAt && (
              <p className="flex flex-wrap gap-x-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400" title={formatDateTime(a.endedAt)}>
                <span className="font-medium text-slate-700 dark:text-slate-300">Ended at:</span>
                <time dateTime={a.endedAt}>{formatDateTime(a.endedAt)}</time>
              </p>
            )}
          </div>
        );
      },
    }),
    // c.accessor('topic', { header: 'Topic', sortingFn: 'alphanumeric',
    //   cell: (info) => <span className="block min-w-[110px] max-w-[200px] break-words">{info.getValue() || '—'}</span>,
    // }),
    c.accessor('duration', { header: 'Duration (Minutes)', sortingFn: 'basic',
      cell: (info) => <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium"><Clock size={15} className="text-slate-400" /> {info.getValue() ?? '—'} min</span>,
    }),
    c.accessor('scheduledDate', { header: 'Scheduled Date',
      sortingFn: (a, b) => scheduledDay(a.original.scheduledDate).localeCompare(scheduledDay(b.original.scheduledDate)),
      cell: (info) => <span className="inline-flex items-center gap-1 whitespace-nowrap"><CalendarDays size={15} className="text-slate-400" /> {formatDate(info.getValue())}</span>,
    }),
    c.accessor('status', { header: 'Status',
      sortingFn: (a, b) => (STATUS_ORDER[a.original.status] ?? 99) - (STATUS_ORDER[b.original.status] ?? 99),
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    c.accessor((a) => a.status === 'SCHEDULED' ? 'Start' : a.status === 'PUBLISHED' ? 'Stop / View' : 'View', {
      id: 'actions', header: 'Actions', sortingFn: 'alphanumeric',
      cell: (info) => <ActivityActions activity={info.row.original} onStart={(id) => start.mutate(id)} onStop={(id) => stop.mutate(id)} busy={busy} />,
    }),
  ], [busy, start.mutate, stop.mutate]);

  useEffect(() => {
    const lastPageIndex = Math.max(0, Math.ceil(filtered.length / pagination.pageSize) - 1);
    if (pagination.pageIndex > lastPageIndex) {
      setPagination((previous) => ({ ...previous, pageIndex: lastPageIndex }));
    }
  }, [filtered.length, pagination.pageIndex, pagination.pageSize]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  return (
    <div className="min-w-0 space-y-5">
      <SectionHeading title="Activities" description="Schedule, start and monitor classroom activities."
        actions={<Link to="/teacher/activities/new" className="btn-primary inline-flex items-center gap-2"><Plus size={18} /> Create Activity</Link>} />

      <section aria-labelledby="today-activities-heading" className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="today-activities-heading" className="flex items-center gap-2 text-base font-bold"><CalendarClock size={19} className="text-blue-600" /> Scheduled Activities</h2>
            <p className="mt-1 text-xs text-slate-500">{formatDate(today)}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
            {todayActivities.length} {todayActivities.length === 1 ? 'activity' : 'activities'}
          </span>
        </div>
        {q.isPending ? <Loading rows={2} /> : q.isError ? (
          <p className="text-sm text-rose-600">Unable to load today's activities.</p>
        ) : todayActivities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-blue-200 bg-white/80 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/60">
            <CalendarDays size={24} className="mx-auto mb-2 text-slate-400" />
            <p className="font-medium">No activities today.</p>
            <p className="mt-1 text-sm text-slate-500">Activities scheduled for today will appear here, whether they are scheduled, live or stopped.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {todayActivities.map((activity) => (
              <div key={activity.id} className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
                <div className="min-w-0 space-y-2">
                  <p className="break-words font-semibold text-slate-900 dark:text-slate-100">{activity.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {formatDate(activity.scheduledDate)}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={13} /> {activity.duration ?? '—'} min</span>
                    <StatusBadge status={activity.status} />
                  </div>
                  {activity.startedAt && <p className="text-xs text-emerald-700 dark:text-emerald-400">Started: {formatDateTime(activity.startedAt)}</p>}
                  {activity.endedAt && <p className="text-xs text-slate-500 dark:text-slate-400">Ended: {formatDateTime(activity.endedAt)}</p>}
                </div>
                <div className="shrink-0">
                  <ActivityActions activity={activity} onStart={(id) => start.mutate(id)} onStop={(id) => stop.mutate(id)} busy={busy} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="activities-table-heading" className="min-w-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="activities-table-heading" className="text-lg font-bold">All Activities</h2>

          </div>
          <div className="relative w-full sm:w-80">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPagination((prev) => ({ ...prev, pageIndex: 0 })); }}
              aria-label="Search activities" placeholder="Search title, topic, status..." className="input w-full !pl-10" />
          </div>
        </div>
        <Card className="min-w-0 overflow-hidden p-0">
          {q.isPending ? <div className="p-6"><Loading /></div> : q.isError ? (
            <div className="p-6"><ErrorState error={q.error} retry={() => void q.refetch()} /></div>
          ) : activities.length === 0 ? (
            <div className="p-6"><Empty title="No activities" description="Create your first activity to get started." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No activities match “{search}”.</div>
          ) : (
            <div className="w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Sortable activities table" tabIndex={0}>
              {/* <table className="w-full min-w-[1250px] border-collapse text-left text-sm"> */}
              <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>{group.headers.map((header) => (
                      <th key={header.id} scope="col"
                        aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'}
                        className="px-2.5 py-3 align-middle"><SortableHeader header={header} /></th>
                    ))}</tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, index) => (
                    <tr key={row.id} className={`${index % 2 ? 'bg-slate-50/80 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'} border-t border-slate-200 transition-colors hover:bg-blue-50/70 dark:border-slate-800 dark:hover:bg-slate-800`}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-2.5 py-3 align-middle">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!q.isPending && !q.isError && filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="activities-page-size" className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Rows per page
                </label>
                <select
                  id="activities-page-size"
                  value={pagination.pageSize}
                  onChange={(event) => setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {[10, 20, 30, 40, 50].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
                  Showing {pagination.pageIndex * pagination.pageSize + 1}–{Math.min((pagination.pageIndex + 1) * pagination.pageSize, filtered.length)} of {filtered.length}
                </span>
              </div>
              <nav aria-label="Activities pagination" className="flex items-center gap-2">
                <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">
                  Previous
                </button>
                <span className="min-w-[94px] text-center text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800">
                  Next
                </button>
              </nav>
            </div>
          )}
        </Card>

      </section>
    </div>
  );
}

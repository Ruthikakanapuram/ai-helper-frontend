
import { useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Plus, Play, Square, Eye, Clock, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import {
  Button, Card, Empty, ErrorState,
  Loading, SectionHeading,
} from '../../components/ui';

const c = createColumnHelper();

const statusStyles = {
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  CLOSED: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  ARCHIVED: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status] || statusStyles.SCHEDULED}`}>
      {status === 'PUBLISHED' ? 'LIVE' : status || 'UNKNOWN'}
    </span>
  );
}
function formatDateTime(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
function formatDate(value) {
  if (!value) return '—';

  // Handle DATE columns without timezone shifts.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
}

function ActivityActions({
  activity,
  onStart,
  onStop,
  isStarting,
  isStopping,
}) {
  const navigate = useNavigate();
  const id = String(activity.id);

  const canStart = activity.status === 'SCHEDULED';
  const canStop = activity.status === 'PUBLISHED';
  const canView = ['PUBLISHED', 'CLOSED', 'ARCHIVED'].includes(
    activity.status
  );

  return (
    <div className="flex items-center gap-2">
      {canStart && (
        <Button
          variant="outline"
          disabled={isStarting || isStopping}
          onClick={() => onStart(id)}
        >
          <Play size={15} />
          Start
        </Button>
      )}

      {canView && (
        <button
          type="button"
          title="View student conversations"
          aria-label={`View ${activity.title} conversations`}
          className="rounded-lg border border-slate-200 p-2.5 text-blue-600 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800"
          onClick={() =>
            void navigate({
              to: '/teacher/activities/$activityId',
              params: { activityId: id },
            })
          }
        >
          <Eye size={17} />
        </button>
      )}

      {canStop && (
        <Button
          variant="danger"
          disabled={isStopping || isStarting}
          onClick={() => {
            if (window.confirm(
              'Stop this activity? All student chats will end.'
            )) {
              onStop(id);
            }
          }}
        >
          <Square size={15} />
          Stop
        </Button>
      )}

      {!canStart && !canStop && !canView && (
        <span className="text-xs text-slate-400">
          No actions
        </span>
      )}
    </div>
  );
}

export function TeacherActivities() {
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
  });

  const activities = Array.isArray(q.data) ? q.data : [];

  const refresh = (activity) => {
    void queryClient.invalidateQueries({
      queryKey: keys.activities,
    });

    if (activity?.id != null) {
      void queryClient.invalidateQueries({
        queryKey: ['activity', String(activity.id)],
      });
    }
  };

  const start = useMutation({
    mutationFn: api.startActivity,
    onSuccess: (activity) => {
      refresh(activity);
      toast.success('Activity started successfully');
    },
    onError: (error) => toast.error(error.message),
  });

  const stop = useMutation({
    mutationFn: api.stopActivity,
    onSuccess: (activity) => {
      refresh(activity);
      toast.success('Activity closed successfully');
    },
    onError: (error) => toast.error(error.message),
  });

  const columns = useMemo(() => [
   
c.accessor('title', {
  header: 'Activity',

  cell: (info) => {
    const activity = info.row.original;

    const startedAt = formatDateTime(activity.startedAt);
    const endedAt = formatDateTime(activity.endedAt);

    return (
      <div className="min-w-[220px] space-y-1">
        {/* Activity name */}
        <p className="font-semibold text-slate-900 dark:text-white">
          {activity.title}
        </p>

        {/* Created date */}
        <p className="text-xs text-slate-500">
          Created: {formatDate(activity.createdAt)}
        </p>

        {/* Show only when activity has started */}
        {startedAt && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Play size={12} />
            <span>
              Started: {startedAt}
            </span>
          </div>
        )}

        {/* Show only when activity has ended */}
        {endedAt && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Square size={12} />
            <span>
              Ended: {endedAt}
            </span>
          </div>
        )}
      </div>
    );
  },
}),


    c.accessor('topic', {
      header: 'Topic',
    }),

    c.accessor('duration', {
      header: 'Duration',
      cell: (info) => (
        <span className="inline-flex items-center gap-1.5">
          <Clock size={15} />
          {info.getValue() ?? '—'} min
        </span>
      ),
    }),

    c.accessor('scheduledDate', {
      header: 'Scheduled Date',
      cell: (info) => (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={15} />
          {formatDate(info.getValue())}
        </span>
      ),
    }),

    c.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),

    c.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <ActivityActions
          activity={info.row.original}
          onStart={(id) => start.mutate(id)}
          onStop={(id) => stop.mutate(id)}
          isStarting={start.isPending}
          isStopping={stop.isPending}
        />
      ),
    }),
  ], [start.isPending, stop.isPending]);

  const table = useReactTable({
    data: activities,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const summary = [
    ['Total Activities', activities.length],
    ['Scheduled', activities.filter(a => a.status === 'SCHEDULED').length],
    ['Live Now', activities.filter(a => a.status === 'PUBLISHED').length],
    ['Closed', activities.filter(a => a.status === 'CLOSED').length],
  ];

  return (
    <>
      <SectionHeading
        title="Activities"
        description="Create, start and monitor classroom activities."
        actions={
          <Link to="/teacher/activities/new" className="btn-primary">
            <Plus size={18} />
            Create Activity
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, count]) => (
          <Card key={label} className="p-5">
            <p className="muted">{label}</p>
            <p className="mt-2 text-3xl font-extrabold">
              {count}
            </p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {q.isPending ? (
          <div className="p-6"><Loading /></div>
        ) : q.isError ? (
          <ErrorState
            error={q.error}
            retry={() => void q.refetch()}
          />
        ) : activities.length === 0 ? (
          <Empty
            title="No activities"
            description="Create your first activity to get started."
          />
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              {table.getHeaderGroups().map(group => (
                <tr key={group.id}>
                  {group.headers.map(header => (
                    <th key={header.id} className="px-5 py-4">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-5 py-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

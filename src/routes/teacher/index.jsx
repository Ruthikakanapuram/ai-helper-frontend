
import { useMemo } from 'react';

import {
  Link,
  useNavigate,
} from '@tanstack/react-router';

import {
  useQuery,
  useMutation,
} from '@tanstack/react-query';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import {
  Plus,
  Play,
  Square,
  Eye,
  Clock,
  Users,
  CalendarDays,
} from 'lucide-react';

import { toast } from 'sonner';

import { api } from '../../lib/api';
import { keys, refreshActivity } from '../../lib/query';

import {
  Button,
  Card,
  Empty,
  ErrorState,
  Loading,
  SectionHeading,
} from '../../components/ui';

const c = createColumnHelper();

function formatDate(value) {
  if (!value) return 'Not scheduled';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const styles = {
    DRAFT:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',

    PUBLISHED:
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',

    ACTIVE:
      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',

    CLOSED:
      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',

    ARCHIVED:
      'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || styles.DRAFT
      }`}
    >
      {status || 'UNKNOWN'}
    </span>
  );
}

export function TeacherActivities() {
  const navigate = useNavigate();

  // Fetch actual activities from NestJS
  const q = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
  });

  const activities = q.data || [];

  // These mutations require matching NestJS endpoints.
  const start = useMutation({
    mutationFn: api.startActivity,

    onSuccess: (activity) => {
      void refreshActivity(activity.id);
      toast.success('Activity is now live');
    },

    onError: (error) => toast.error(error.message),
  });

  const stop = useMutation({
    mutationFn: api.stopActivity,

    onSuccess: (activity) => {
      void refreshActivity(activity.id);
      toast.success('Activity ended');
    },

    onError: (error) => toast.error(error.message),
  });

  const columns = useMemo(
    () => [
      c.accessor('name', {
        header: 'Activity',

        cell: (info) => (
          <div>
            <div className="font-semibold">
              {info.getValue()}
            </div>

            <span className="text-xs text-slate-500">
              Created: {formatDate(info.row.original.createdAt)}
            </span>
          </div>
        ),
      }),

      c.accessor('topic', {
        header: 'Topic',

        cell: (info) => (
          <span>{info.getValue() || '-'}</span>
        ),
      }),

      c.accessor('duration', {
        header: 'Duration',

        cell: (info) => (
          <span className="flex items-center gap-2">
            <Clock size={15} />
            {info.getValue()} min
          </span>
        ),
      }),

      c.accessor('scheduledDate', {
        header: 'Scheduled Date',

        cell: (info) => (
          <span className="flex items-center gap-2">
            <CalendarDays size={15} />
            {formatDate(info.getValue())}
          </span>
        ),
      }),

      c.accessor('status', {
        header: 'Status',

        cell: (info) => (
          <StatusBadge status={info.getValue()} />
        ),
      }),

      c.accessor('studentCount', {
        header: 'Students',

        cell: (info) => {
          const count = info.getValue();

          return (
            <span className="flex items-center gap-2">
              <Users size={15} />
              {count === null ? '—' : count}
            </span>
          );
        },
      }),

      c.display({
        id: 'actions',
        header: 'Actions',

        cell: (info) => {
          const activity = info.row.original;

          return (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="!px-2.5"
                onClick={() =>
                  void navigate({
                    to: '/teacher/activities/$activityId',
                    params: {
                      activityId: activity.id,
                    },
                  })
                }
              >
                <Eye size={15} />
                View
              </Button>

              {activity.status === 'PUBLISHED' && (
                <Button
                  variant="outline"
                  className="!px-2.5"
                  disabled={start.isPending}
                  onClick={() => start.mutate(activity.id)}
                >
                  <Play size={14} />
                  Start
                </Button>
              )}

              {activity.status === 'ACTIVE' && (
                <Button
                  variant="danger"
                  className="!px-2.5"
                  disabled={stop.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Stop this activity for all students?'
                      )
                    ) {
                      stop.mutate(activity.id);
                    }
                  }}
                >
                  <Square size={14} />
                  Stop
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    [navigate, start.isPending, stop.isPending]
  );

  const table = useReactTable({
    data: activities,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const stats = {
    total: activities.length,

    active: activities.filter(
      (activity) => activity.status === 'ACTIVE'
    ).length,

    drafts: activities.filter(
      (activity) => activity.status === 'DRAFT'
    ).length,
  };

  return (
    <>
      <SectionHeading
        title="Activities"
        description="Create learning activities and monitor student participation."
        actions={
          <Link
            to="/teacher/activities/new"
            className="btn-primary"
          >
            <Plus size={18} />
            Create Activity
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ['Total Activities', stats.total],
          ['Live Now', stats.active],
          ['Drafts', stats.drafts],
        ].map(([label, count]) => (
          <Card key={label} className="p-5">
            <p className="muted">{label}</p>

            <p className="mt-2 text-3xl font-extrabold">
              {count}
            </p>
          </Card>
        ))}
      </div>

      {/* Activities table */}
      <Card className="overflow-x-auto">
        {q.isPending ? (
          <div className="p-6">
            <Loading />
          </div>
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
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-5 py-4"
                    >
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
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-5 py-4"
                    >
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

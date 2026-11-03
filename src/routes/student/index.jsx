import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Archive,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock,
  History,
  RadioTower,
} from 'lucide-react';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Card, Empty, ErrorState, Loading, SectionHeading } from '../../components/ui';

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------

function formatDate(value) {
  if (!value) return 'Not scheduled';

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(...value.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))
    : new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Invalid date'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

function toTime(value) {
  const time = value ? new Date(value).getTime() : NaN;

  return Number.isNaN(time) ? null : time;
}

// Most recently started activity first. Activities that have not started yet
// come after, with the soonest scheduled one first.
function sortActivities(list) {
  return [...list].sort((a, b) => {
    const startA = toTime(a.startedAt);
    const startB = toTime(b.startedAt);

    if (startA !== null && startB !== null) return startB - startA;
    if (startA !== null) return -1;
    if (startB !== null) return 1;

    const dateA = toTime(a.scheduledDate);
    const dateB = toTime(b.scheduledDate);

    if (dateA !== null && dateB !== null) return dateA - dateB;
    if (dateA !== null) return -1;
    if (dateB !== null) return 1;

    return Number(b.id) - Number(a.id) || 0;
  });
}

// ------------------------------------------------------
// Status badge
// ------------------------------------------------------

function StatusBadge({ status }) {
  const statusConfig = {
    SCHEDULED: {
      label: 'Scheduled',
      Icon: CalendarClock,
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },

    PUBLISHED: {
      label: 'Live',
      Icon: RadioTower,
      className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    },

    CLOSED: {
      label: 'Closed',
      Icon: CircleCheck,
      className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },

    ARCHIVED: {
      label: 'Archived',
      Icon: Archive,
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
  };

  const current = statusConfig[status] ?? {
    label: status || 'Unknown',
    Icon: CalendarClock,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };

  const Icon = current.Icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${current.className}`}
    >
      <Icon size={12} className={status === 'PUBLISHED' ? 'animate-pulse' : ''} />
      {current.label}
    </span>
  );
}

// ------------------------------------------------------
// Page
// ------------------------------------------------------

export function StudentHome() {
  const user = useAuth((state) => state.user);

  const activitiesQuery = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const activities = useMemo(
    () => sortActivities(Array.isArray(activitiesQuery.data) ? activitiesQuery.data : []),
    [activitiesQuery.data],
  );

  return (
    <>
      <SectionHeading
        title="My Activities"
        description={`Welcome back, ${user?.name?.split(' ')[0] || 'Student'}. Explore your learning activities.`}
      />

      {activitiesQuery.isPending ? (
        <Loading rows={4} />
      ) : activitiesQuery.isError ? (
        <ErrorState error={activitiesQuery.error} retry={() => void activitiesQuery.refetch()} />
      ) : activities.length === 0 ? (
        <Card>
          <Empty title="No activities available" description="No activities have been assigned yet." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {activities.map((activity) => (
            <StudentActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------
// Activity card
// ------------------------------------------------------

function InfoPill({ icon: Icon, children }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {Icon ? <Icon size={13} className="shrink-0 text-slate-400" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function TimeBox({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-900">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function StudentActivityCard({ activity }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.user?.id);

  const {
    id,
    title,
    topic,
    description,
    duration,
    scheduledDate,
    startedAt,
    endedAt,
    status,
    chatSession,
  } = activity;

  const activityId = String(id);
  const sessionId = chatSession?.id == null ? null : String(chatSession.id);

  const isLive = status === 'PUBLISHED';
  const hasSession = Boolean(sessionId);
  const sessionActive = chatSession?.status === 'ACTIVE';

  const canEnter = isLive && (!hasSession || sessionActive);
  const canViewHistory = hasSession && !canEnter;

  function openChat(session) {
    if (!session?.id) {
      toast.error('Chat session not found');
      return;
    }

    const sessionKey = ['chat-session-entry', String(userId), String(activityId)];

    // Cache the returned session before navigating.
    queryClient.setQueryData(sessionKey, session);

    // Update the activity in the cached list immediately.
    queryClient.setQueryData(keys.activities, (previous) => {
      if (!Array.isArray(previous)) {
        return previous;
      }

      return previous.map((item) =>
        String(item.id) === activityId
          ? {
              ...item,
              chatSession: {
                id: String(session.id),
                status: session.status,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
              },
            }
          : item,
      );
    });

    // Open StudentChat using the activity route.
    void navigate({
      to: '/student/activities/$activityId',
      params: { activityId },
    });
  }

  const enterMutation = useMutation({
    mutationFn: async () => {
      // Existing session: reuse it.
      if (chatSession?.id) {
        return chatSession;
      }

      // First entry: create session in NestJS.
      return api.enterActivity(activityId);
    },

    onSuccess: (session) => {
      openChat(session);

      void queryClient.invalidateQueries({
        queryKey: keys.activities,
        refetchType: 'none',
      });
    },

    onError: (error) => {
      toast.error(error.message || 'Unable to enter activity');
    },
  });

  const historyMutation = useMutation({
    mutationFn: () => api.getChatHistory(sessionId),

    onSuccess: (history) => {
      if (!history?.session?.id) {
        toast.error('Invalid history response');
        return;
      }

      const sid = String(history.session.id);

      queryClient.setQueryData(['chat-history', sid], history);
      openChat(history.session);
    },

    onError: (error) => toast.error(error.message || 'Unable to load chat history'),
  });

  const busy = enterMutation.isPending || historyMutation.isPending;

  const startedLabel = formatDateTime(startedAt);
  const endedLabel = formatDateTime(endedAt);

  return (
    <Card
      className={`flex h-full flex-col gap-3 p-4 transition hover:shadow-md sm:p-5 ${
        isLive ? 'ring-1 ring-emerald-500/40' : ''
      }`}
    >
      {/* Icon, title and status */}

      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950">
          <BookOpen size={18} />
        </div>

        <h2
          title={title}
          className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug"
        >
          {title}
        </h2>

        <StatusBadge status={status} />
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-500 dark:text-slate-400">
        {description || 'Explore this learning activity.'}
      </p>

      {/* Details */}

      <div className="flex flex-wrap gap-1.5">
        {topic ? <InfoPill icon={BookOpen}>{topic}</InfoPill> : null}

        <InfoPill icon={Clock}>{duration ?? '—'} min</InfoPill>

        <InfoPill icon={CalendarDays}>{formatDate(scheduledDate)}</InfoPill>
      </div>

      {startedLabel || endedLabel ? (
        <div className="grid grid-cols-2 gap-2">
          <TimeBox label="Started" value={startedLabel || '—'} />
          <TimeBox label="Ended" value={endedLabel || (isLive ? 'In progress' : '—')} />
        </div>
      ) : null}

      {/* Action */}

      <div className="mt-auto pt-1">
        {canEnter ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => enterMutation.mutate()}
            className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
          >
            <ArrowRight size={16} />
            {busy ? 'Opening...' : sessionId ? 'Continue Chat' : 'Enter Activity'}
          </button>
        ) : canViewHistory ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => historyMutation.mutate()}
            className="btn-outline flex w-full items-center justify-center gap-2 text-sm"
          >
            <History size={16} />
            {busy ? 'Loading History...' : 'View History'}
          </button>
        ) : (
          <button type="button" disabled className="btn-outline w-full text-sm">
            {status === 'SCHEDULED' ? 'Waiting for Teacher' : 'No Chat History'}
          </button>
        )}
      </div>
    </Card>
  );
}

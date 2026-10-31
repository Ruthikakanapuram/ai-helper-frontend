
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { BookOpen, Clock, ArrowRight, CalendarDays, History } from 'lucide-react';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Card, Empty, ErrorState, Loading, SectionHeading } from '../../components/ui';
import {
  RadioTower,
  CalendarClock,
  CircleCheck,
  Archive,
} from 'lucide-react';
import { ActivityTimeline } from '../../features/activities/ActivityTimeline';

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(...value.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}


function StatusBadge({ status }) {
  const statusConfig = {
    SCHEDULED: {
      label: 'SCHEDULED',
      Icon: CalendarClock,
      className:
        'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },

    PUBLISHED: {
      label: 'LIVE',
      Icon: RadioTower,
      className:
        'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    },

    CLOSED: {
      label: 'CLOSED',
      Icon: CircleCheck,
      className:
        'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },

    ARCHIVED: {
      label: 'ARCHIVED',
      Icon: Archive,
      className:
        'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    },
  };

  const current = statusConfig[status] ?? {
    label: status || 'UNKNOWN',
    Icon: CalendarClock,
    className: 'bg-slate-100 text-slate-600',
  };

  const Icon = current.Icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${current.className}`}
    >
      <Icon
        size={14}
        className={status === 'PUBLISHED' ? 'animate-pulse' : ''}
      />

      {current.label}
    </span>
  );
}

export function StudentHome() {
  const user = useAuth((state) => state.user);
  const activitiesQuery = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];

  return (
    <>
      <SectionHeading title="My Activities" description={`Welcome back, ${user?.name?.split(' ')[0] || 'Student'}. Explore your learning activities.`} />
      {activitiesQuery.isPending ? <Loading rows={4} />
        : activitiesQuery.isError ? <ErrorState error={activitiesQuery.error} retry={() => void activitiesQuery.refetch()} />
        : activities.length === 0 ? <Card><Empty title="No activities available" description="No activities have been assigned yet." /></Card>
        : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{activities.map((activity) => <StudentActivityCard key={activity.id} activity={activity} />)}</div>}
    </>
  );
}

function StudentActivityCard({ activity }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.user?.id);
  // const { id, title, topic, description, duration, scheduledDate, status, chatSession } = activity;
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

const sessionActive =
  chatSession?.status === 'ACTIVE';

const canEnter =
  isLive && (!hasSession || sessionActive);

const canViewHistory =
  hasSession && !canEnter;

  const sessionKey = ['chat-session-entry', String(userId), activityId];

  // function openChat(session) {
  //   if (!session?.id) { toast.error('Chat session not found'); return; }
  //   queryClient.setQueryData(sessionKey, session);
  //   void navigate({ to: '/student/activities/$activityId', params: { activityId } });
  // }

  // const enterMutation = useMutation({
  //   mutationFn: () => sessionId ? Promise.resolve(chatSession) : api.enterActivity(id),
  //   onSuccess: (session) => {
  //     if (!session?.id) { toast.error('Chat session not found'); return; }
  //     openChat(session);
  //     void queryClient.invalidateQueries({ queryKey: keys.activities });
  //   },
  //   onError: (error) => toast.error(error.message || 'Unable to open activity'),
  // });

function openChat(session) {
  if (!session?.id) {
    toast.error('Chat session not found');
    return;
  }

  const sessionKey = [
    'chat-session-entry',
    String(userId),
    String(activityId),
  ];

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
        : item
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
    toast.error(
      error.message || 'Unable to enter activity'
    );
  },
});

  const historyMutation = useMutation({
    mutationFn: () => api.getChatHistory(sessionId),
    onSuccess: (history) => {
      if (!history?.session?.id) { toast.error('Invalid history response'); return; }
      const sid = String(history.session.id);
      queryClient.setQueryData(['chat-history', sid], history);
      openChat(history.session);
    },
    onError: (error) => toast.error(error.message || 'Unable to load chat history'),
  });

  const busy = enterMutation.isPending || historyMutation.isPending;
  return (
    <Card className="flex flex-col p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950"><BookOpen size={22} /></div>
        <StatusBadge status={status} />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="muted mt-2">{description || 'Explore this learning activity.'}</p>
      <div className="mt-auto pt-6">

<div className="mb-5 space-y-4">
  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
    <span>
      Topic:{' '}
      <strong className="text-slate-700 dark:text-slate-200">
        {topic}
      </strong>
    </span>

    <span className="inline-flex items-center gap-1.5">
      <Clock size={15} />
      {duration ?? '—'} minutes
    </span>

    <span className="inline-flex items-center gap-1.5">
      <CalendarDays size={15} />
      {formatDate(scheduledDate)}
    </span>
  </div>

  <ActivityTimeline
    startedAt={startedAt}
    endedAt={endedAt}
    status={status}
  />
</div>

        {canEnter ? (
          <button type="button" disabled={busy} onClick={() => enterMutation.mutate()} className="btn-primary flex w-full items-center justify-center gap-2">
            <ArrowRight size={17} />{busy ? 'Opening...' : sessionId ? 'Continue Chat' : 'Enter Activity'}
          </button>
        ) : canViewHistory ? (
          <button type="button" disabled={busy} onClick={() => historyMutation.mutate()} className="btn-outline flex w-full items-center justify-center gap-2">
            <History size={17} />{busy ? 'Loading History...' : 'View History'}
          </button>
        ) : (
          <button type="button" disabled className="btn-outline w-full">{status === 'SCHEDULED' ? 'Waiting for Teacher' : 'No Chat History'}</button>
        )}
      </div>
    </Card>
  );
}

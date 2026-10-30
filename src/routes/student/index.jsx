
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { BookOpen, Clock, ArrowRight, CalendarDays, History } from 'lucide-react';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Card, Empty, ErrorState, Loading, SectionHeading } from '../../components/ui';

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(...value.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
  const colors = {
    SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    CLOSED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    ARCHIVED: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${colors[status] || 'bg-slate-100 text-slate-700'}`}>{status === 'PUBLISHED' ? 'LIVE' : status || 'UNKNOWN'}</span>;
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
  const { id, title, topic, description, duration, scheduledDate, status, chatSession } = activity;
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

  function openChat(session) {
    if (!session?.id) { toast.error('Chat session not found'); return; }
    queryClient.setQueryData(sessionKey, session);
    void navigate({ to: '/student/activities/$activityId', params: { activityId } });
  }

  const enterMutation = useMutation({
    mutationFn: () => sessionId ? Promise.resolve(chatSession) : api.enterActivity(id),
    onSuccess: (session) => {
      if (!session?.id) { toast.error('Chat session not found'); return; }
      openChat(session);
      void queryClient.invalidateQueries({ queryKey: keys.activities });
    },
    onError: (error) => toast.error(error.message || 'Unable to open activity'),
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
        <div className="mb-5 space-y-3 text-sm text-slate-500">
          <div>Topic: <strong>{topic}</strong></div>
          <div className="flex items-center gap-2"><Clock size={15} />{duration ?? '—'} minutes</div>
          <div className="flex items-center gap-2"><CalendarDays size={15} />{formatDate(scheduledDate)}</div>
          {sessionId && <div>Session: <strong>{chatSession.status}</strong></div>}
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

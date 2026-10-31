
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Transcript } from '../../features/chat/transcript';
import { remaining, mmss } from '../../lib/utils';
import { Badge, Button, ErrorState, Loading, Spinner } from '../../components/ui';
import {
  RadioTower,
  CircleCheck,
  ClockAlert,
  CircleStop,
} from 'lucide-react';

const finalStatuses = ['COMPLETED', 'EXPIRED', 'TERMINATED'];
const endedActivities = ['CLOSED', 'ARCHIVED'];

function requestUuid() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') throw new Error('Secure random generation unavailable. Use HTTPS or localhost.');
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function turnToMessages(turn) {
  const id = String(turn.id ?? turn.clientRequestId);
  const result = [{ id: `${id}-prompt`, role: 'user', content: turn.prompt ?? '', createdAt: turn.createdAt ?? null }];
  if (typeof turn.response === 'string' && turn.response.length) {
    result.push({ id: `${id}-response`, role: 'assistant', content: turn.response, createdAt: turn.completedAt ?? turn.createdAt ?? null });
  }
  return result;
}

function mergeTurn(items, incoming) {
  const turns = Array.isArray(items) ? items : [];
  const id = String(incoming.id ?? '');
  if (!id) return turns;
  return turns.some((t) => String(t.id) === id)
    ? turns.map((t) => String(t.id) === id ? incoming : t)
    : [...turns, incoming];
}

export function StudentChat() {
  const { activityId } = useParams({ from: '/student/activities/$activityId' });
  const userId = useAuth((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [draftRequest, setDraftRequest] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldFollowRef = useRef(true);

  // GET /activities returns the logged-in student's assigned activities plus chatSession.
  // It supports CLOSED activity history, even if GET /activities/:id denies closed activities.
  const activitiesQuery = useQuery({
    queryKey: keys.activities,
    queryFn: api.getActivities,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });
  const activity = Array.isArray(activitiesQuery.data)
    ? activitiesQuery.data.find((item) => String(item.id) === String(activityId))
    : null;
  const listedSession = activity?.chatSession ?? null;
  const isPublished = activity?.status === 'PUBLISHED';



  const sessionKey = [
    'chat-session-entry',
    String(userId),
    String(activityId),
  ];

  const sessionQuery = useQuery({
    queryKey: sessionKey,

    enabled: Boolean(
      userId &&
      activityId &&
      activitiesQuery.isSuccess &&
      activity
    ),

    queryFn: async () => {
      // The activity-list response includes the existing session.
      if (listedSession?.id) {
        return listedSession;
      }

      // No session exists yet.
      // Only create a session if the activity is published.
      if (activity?.status === 'PUBLISHED') {
        return api.enterActivity(activityId);
      }

      // Closed/scheduled activity without a session.
      return null;
    },

    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const session = sessionQuery.data;
  const sessionId = session?.id == null ? null : String(session.id);
  const historyKey = ['chat-history', String(sessionId)];
  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: () => api.getChatHistory(sessionId),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => finalStatuses.includes(query.state.data?.session?.status) || endedActivities.includes(activity?.status) ? false : 5000,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveSession = historyQuery.data?.session ?? session;
  const secs = remaining(activity?.startedAt, activity?.duration ?? 30, now);
  const sessionEnded = finalStatuses.includes(
    effectiveSession?.status
  );

  const activityEnded = endedActivities.includes(
    activity?.status
  );

  const canChat =
    activity?.status === 'PUBLISHED' &&
    effectiveSession?.status === 'ACTIVE' &&
    !sessionEnded &&
    !activityEnded;
  const send = useMutation({
    mutationFn: ({ prompt, clientRequestId }) => api.sendChatPrompt(sessionId, prompt, clientRequestId),
    onSuccess: (turn) => {
      queryClient.setQueryData(historyKey, (previous) => previous ? { ...previous, messages: mergeTurn(previous.messages, turn) } : previous);
      setText('');
      setDraftRequest(null);
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
    onError: (error) => {
      toast.error(error.message || 'Unable to send. Retry with the same prompt.');
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
    onSettled: () => { sendingRef.current = false; setSending(false); },
  });

  const turns = historyQuery.data?.messages;
  const messages = useMemo(() => (Array.isArray(turns) ? [...turns] : [])
    .sort((a, b) => Number(a.turnNumber ?? 0) - Number(b.turnNumber ?? 0))
    .flatMap(turnToMessages), [turns]);

  function handleScroll() {
    const el = scrollRef.current;
    if (el) shouldFollowRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }
  useEffect(() => {
    if (shouldFollowRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  function submit() {
    if (sendingRef.current || sending || !canChat || !sessionId) return;
    const prompt = text.trim();
    if (!prompt) return;
    try {
      const clientRequestId = draftRequest?.prompt === prompt ? draftRequest.clientRequestId : requestUuid();
      setDraftRequest({ prompt, clientRequestId });
      sendingRef.current = true;
      setSending(true);
      send.mutate({ prompt, clientRequestId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate request ID');
    }
  }

  if (activitiesQuery.isPending || sessionQuery.isPending || (sessionId && historyQuery.isPending)) return <Loading rows={8} />;
  if (activitiesQuery.isError) return <ErrorState error={activitiesQuery.error} retry={() => void activitiesQuery.refetch()} />;
  if (!activity) return <div role="alert" className="panel p-8">Activity not found or not assigned to you.</div>;
  if (sessionQuery.isError) return <ErrorState error={sessionQuery.error} retry={() => void sessionQuery.refetch()} />;
  if (historyQuery.isError) return <ErrorState error={historyQuery.error} retry={() => void historyQuery.refetch()} />;

  return (
    <div className="flex h-[calc(100vh-170px)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:h-[calc(100vh-90px)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link to="/student" aria-label="Back to activities" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft size={19} /></Link>
          <div><h1 className="font-bold">{activity.title}</h1><div className="muted">{activity.topic}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm font-bold dark:bg-slate-800"><Clock size={15} />{activity.startedAt ? mmss(secs) : '--:--'}</span>

          {(() => {
            const status = sessionEnded || activityEnded
              ? session?.status === 'ACTIVE'
                ? 'TERMINATED'
                : session?.status
              : session?.status;

            const config = {
              ACTIVE: {
                label: 'LIVE',
                Icon: RadioTower,
                className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
              },
              COMPLETED: {
                label: 'COMPLETED',
                Icon: CircleCheck,
                className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
              },
              EXPIRED: {
                label: 'EXPIRED',
                Icon: ClockAlert,
                className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
              },
              TERMINATED: {
                label: 'TERMINATED',
                Icon: CircleStop,
                className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
              },
            };

            const current = config[status] ?? {
              label: status || 'UNKNOWN',
              Icon: ClockAlert,
              className: 'bg-slate-100 text-slate-600',
            };

            return (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${current.className}`}>
                <current.Icon
                  size={14}
                  className={status === 'ACTIVE' ? 'animate-pulse' : ''}
                />
                {current.label}
              </span>
            );
          })()}

        </div>
      </header>
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Transcript messages={messages} typing={sending} emptyText="Ask a question to start exploring this topic." />
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        {!sessionId ? <div role="status" className="rounded-xl bg-slate-100 p-4 text-center dark:bg-slate-800">No chat history exists for this activity.</div>
          : !canChat ? <div role="status" className="rounded-xl bg-amber-50 p-4 text-center font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Session ended · Chat history is read-only.</div>
            : <div className="flex items-end gap-3">
              <textarea aria-label="Your message" className="input max-h-36 min-h-[48px] flex-1 resize-none" rows={2} placeholder="Ask anything about this topic…" value={text} disabled={sending} onChange={(event) => { setText(event.target.value); if (draftRequest && event.target.value.trim() !== draftRequest.prompt) setDraftRequest(null); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} />
              <Button aria-label="Send message" className="!h-12" disabled={!text.trim() || sending} onClick={submit}>{sending ? <Spinner /> : <Send size={18} />}</Button>
            </div>}
        <p className="mt-2 text-center text-xs text-slate-400">AI can make mistakes. Check important information with your teacher.</p>
      </div>
    </div>
  );
}


import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Clock, Send, RadioTower, CircleCheck, ClockAlert, CircleStop,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { keys } from '../../lib/query';
import { useAuth } from '../../features/auth/store';
import { Transcript } from '../../features/chat/transcript';
import { remaining, mmss } from '../../lib/utils';
import { Button, ErrorState, Loading, Spinner } from '../../components/ui';

const FINAL_STATUSES = ['COMPLETED', 'EXPIRED', 'TERMINATED'];
const ENDED_ACTIVITIES = ['CLOSED', 'ARCHIVED'];

function requestUuid() {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random generation unavailable. Open the app on HTTPS or localhost.');
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function turnToMessages(turn) {
  const id = String(turn.id ?? turn.clientRequestId);
  const result = [{
    id: `${id}-prompt`,
    role: 'user',
    content: turn.prompt ?? '',
    createdAt: turn.createdAt ?? null,
  }];
  if (typeof turn.response === 'string' && turn.response.length > 0) {
    result.push({
      id: `${id}-response`,
      role: 'assistant',
      content: turn.response,
      createdAt: turn.completedAt ?? turn.createdAt ?? null,
    });
  }
  return result;
}

function mergeTurn(items, incoming) {
  const turns = Array.isArray(items) ? items : [];
  const id = String(incoming.id ?? '');
  if (!id) return turns;
  return turns.some((turn) => String(turn.id) === id)
    ? turns.map((turn) => String(turn.id) === id ? incoming : turn)
    : [...turns, incoming];
}

function SessionStatus({ status }) {
  const config = {
    ACTIVE: { label: 'LIVE', Icon: RadioTower, style: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
    COMPLETED: { label: 'COMPLETED', Icon: CircleCheck, style: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
    EXPIRED: { label: 'EXPIRED', Icon: ClockAlert, style: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    TERMINATED: { label: 'TERMINATED', Icon: CircleStop, style: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  };
  const current = config[status] ?? { label: status ?? 'UNKNOWN', Icon: ClockAlert, style: 'bg-slate-100 text-slate-700' };
  const Icon = current.Icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${current.style}`}>
      <Icon size={14} className={status === 'ACTIVE' ? 'animate-pulse' : ''} />
      {current.label}
    </span>
  );
}

export function StudentChat() {
  const { activityId } = useParams({ from: '/student/activities/$activityId' });
  const userId = useAuth((state) => state.user?.id);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [pendingPrompt, setPendingPrompt] = useState(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldFollowRef = useRef(true);

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

  const sessionKey = ['chat-session-entry', String(userId), String(activityId)];
  const sessionQuery = useQuery({
    queryKey: sessionKey,
    enabled: Boolean(userId && activityId && activitiesQuery.isSuccess && activity),
    queryFn: () => {
      if (listedSession?.id) return listedSession;
      if (activity?.status === 'PUBLISHED') return api.enterActivity(activityId);
      return null;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const session = sessionQuery.data;
  const sessionId = session?.id == null ? null : String(session.id);
  const historyKey = ['chat-history', String(sessionId)];
  const historyQuery = useQuery({
    queryKey: historyKey,
    queryFn: () => api.getChatHistory(sessionId),
    enabled: Boolean(sessionId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (
      sending || FINAL_STATUSES.includes(query.state.data?.session?.status) ||
      ENDED_ACTIVITIES.includes(activity?.status) ? false : 5000
    ),
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const effectiveSession = historyQuery.data?.session ?? session;
  const sessionEnded = FINAL_STATUSES.includes(effectiveSession?.status);
  const activityEnded = ENDED_ACTIVITIES.includes(activity?.status);
  const canChat = activity?.status === 'PUBLISHED' && effectiveSession?.status === 'ACTIVE' && !sessionEnded && !activityEnded;
  const secs = remaining(activity?.startedAt, activity?.duration ?? 30, now);
  const turns = historyQuery.data?.messages;

  const send = useMutation({
    mutationFn: ({ prompt, clientRequestId }) => api.sendChatPrompt(sessionId, prompt, clientRequestId),
    onSuccess: (turn) => {
      queryClient.setQueryData(historyKey, (old) => old
        ? { ...old, messages: mergeTurn(old.messages, turn) }
        : { session: effectiveSession, messages: [turn] });
      setPendingPrompt(null);
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
    onError: (error) => {
      setPendingPrompt((previous) => previous ? { ...previous, status: 'FAILED' } : null);
      toast.error(error.message || 'Unable to send prompt.');
    },
    onSettled: () => {
      sendingRef.current = false;
      setSending(false);
    },
  });

  const messages = useMemo(() => {
    const savedTurns = Array.isArray(turns)
      ? [...turns].sort((a, b) => Number(a.turnNumber ?? 0) - Number(b.turnNumber ?? 0))
      : [];
    const savedMessages = savedTurns.flatMap(turnToMessages);
    if (!pendingPrompt) return savedMessages;

    // Match by UUID if the history API includes clientRequestId.
    // Until then, match only a NEW turn, after the turnNumber observed at submit time.
    // This avoids duplicate user bubbles even when polling returns PROCESSING rows.
    const persisted = savedTurns.some((turn) => {
      if (turn.clientRequestId && String(turn.clientRequestId) === pendingPrompt.clientRequestId) {
        return true;
      }
      return Number(turn.turnNumber) > pendingPrompt.lastTurnNumber && turn.prompt === pendingPrompt.prompt;
    });
    if (persisted) return savedMessages;

    return [...savedMessages, {
      id: `pending-${pendingPrompt.clientRequestId}`,
      role: 'user',
      content: pendingPrompt.prompt,
      createdAt: pendingPrompt.createdAt,
      status: pendingPrompt.status,
    }];
  }, [turns, pendingPrompt]);

  function handleScroll() {
    const element = scrollRef.current;
    if (element) shouldFollowRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }
  useEffect(() => {
    if (shouldFollowRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  function submit() {
    if (sendingRef.current || sending || !canChat || !sessionId) return;
    const prompt = text.trim();
    if (!prompt) return;
    try {
      const clientRequestId = requestUuid();
      const savedTurns = queryClient.getQueryData(historyKey)?.messages ?? [];
      const lastTurnNumber = Math.max(0, ...savedTurns.map((turn) => Number(turn.turnNumber) || 0));
      sendingRef.current = true;
      shouldFollowRef.current = true;
      setPendingPrompt({
        prompt,
        clientRequestId,
        lastTurnNumber,
        createdAt: new Date().toISOString(),
        status: 'PROCESSING',
      });
      setText('');
      setSending(true);
      send.mutate({ prompt, clientRequestId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create request ID');
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
          <Link to="/student" aria-label="Back to activities" className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={19} />
          </Link>
          <div><h1 className="font-bold">{activity.title}</h1><div className="muted">{activity.topic}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm font-bold dark:bg-slate-800">
            <Clock size={15} />{activity.startedAt ? mmss(secs) : '--:--'}
          </span>
          <SessionStatus status={activityEnded && effectiveSession?.status === 'ACTIVE' ? 'TERMINATED' : effectiveSession?.status} />
        </div>
      </header>
      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Transcript messages={messages} typing={sending} emptyText="Ask a question to start exploring this topic." />
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        {!sessionId ? (
          <div role="status" className="rounded-xl bg-slate-100 p-4 text-center dark:bg-slate-800">No chat history exists for this activity.</div>
        ) : !canChat ? (
          <div role="status" className="rounded-xl bg-amber-50 p-4 text-center font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Session ended · Chat history is read-only.</div>
        ) : (
          <>
            {pendingPrompt?.status === 'FAILED' && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                The request failed. Your prompt is preserved above. You can copy and send it again as a new prompt.
              </div>
            )}
            <div className="flex items-end gap-3">
              <textarea
                aria-label="Your message"
                className="input max-h-36 min-h-[48px] flex-1 resize-none"
                rows={2}
                placeholder="Ask anything about this topic…"
                value={text}
                disabled={sending}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <Button aria-label="Send message" className="!h-12" disabled={!text.trim() || sending} onClick={submit}>
                {sending ? <Spinner /> : <Send size={18} />}
              </Button>
            </div>
          </>
        )}
        <p className="mt-2 text-center text-xs text-slate-400">AI can make mistakes. Check important information with your teacher.</p>
      </div>
    </div>
  );
}
